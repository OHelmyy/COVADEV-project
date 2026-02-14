# apps/api/projects_api.py
from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods, require_POST

from apps.analysis.models import AnalysisRun, BpmnTask, MatchResult
from apps.analysis.services import run_analysis_for_project

from apps.accounts.rbac import is_admin, is_evaluator
from apps.projects.models import Project, ProjectMembership, CodeFile, ProjectFile
from apps.projects.services import save_bpmn_file, save_code_zip_and_extract


# ---------------------------
# Permissions helpers
# ---------------------------

def _is_project_evaluator(project: Project, user: User) -> bool:
    """
    Evaluator of this specific project OR admin.
    """
    if is_admin(user):
        return True
    return is_evaluator(user) and getattr(project, "evaluator_id", None) == user.id


def _is_project_developer(project: Project, user: User) -> bool:
    """
    Any developer member of this project OR admin.
    """
    if is_admin(user):
        return True
    return ProjectMembership.objects.filter(project=project, user=user).exists()


def _can_open_project(project: Project, user: User) -> bool:
    """
    Admin OR evaluator assigned to this project OR developer member.
    """
    return _is_project_evaluator(project, user) or _is_project_developer(project, user)


def _latest_file(project: Project, file_type: str):
    return (
        ProjectFile.objects
        .filter(project=project, file_type=file_type)
        .select_related("uploaded_by")
        .order_by("-created_at")
        .first()
    )


# ---------------------------
# JSON helpers
# ---------------------------

def _json_project_summary(p: Project, user: User):
    """
    Frontend expects:
      membership: { role: "ADMIN|EVALUATOR|DEVELOPER" }
    """
    if is_admin(user):
        role = "ADMIN"
    elif getattr(p, "evaluator_id", None) == user.id and is_evaluator(user):
        role = "EVALUATOR"
    elif ProjectMembership.objects.filter(project=p, user=user).exists():
        role = "DEVELOPER"
    else:
        role = None

    return {
        "id": p.id,
        "name": p.name,
        "description": p.description or "",
        "similarityThreshold": float(p.similarity_threshold),
        "membership": {"role": role} if role else None,
    }


def _json_file_payload(f: ProjectFile | None):
    if not f:
        return None

    payload = {
        "id": f.id,
        "originalName": f.original_name,
        "createdAt": f.created_at.isoformat() if f.created_at else None,
        "uploadedBy": f.uploaded_by.username if f.uploaded_by else None,
        "fileType": getattr(f, "file_type", None),
    }

    # ✅ BPMN pre-check fields (only if they exist on the model)
    # Your template references:
    # - is_well_formed
    # - precheck_warnings
    # - precheck_errors
    # - bpmn_summary
    if getattr(f, "file_type", None) == "BPMN":
        payload["isWellFormed"] = bool(getattr(f, "is_well_formed", False))
        payload["precheckWarnings"] = getattr(f, "precheck_warnings", []) or []
        payload["precheckErrors"] = getattr(f, "precheck_errors", []) or []
        payload["bpmnSummary"] = getattr(f, "bpmn_summary", "") or ""

    return payload

def _json_project_detail(project: Project, user: User):
    active_bpmn = project.active_bpmn
    active_code = project.active_code

    latest_bpmn = _latest_file(project, "BPMN")
    latest_code = _latest_file(project, "CODE")

    code_files_count = CodeFile.objects.filter(project=project).count()
    tasks_count = BpmnTask.objects.filter(project=project).count()
    matches_count = MatchResult.objects.filter(project=project).count()

    runs = AnalysisRun.objects.filter(project=project).order_by("-created_at")[:10]

    # membership list (developers only) + evaluator separate
    members = (
        ProjectMembership.objects
        .select_related("user")
        .filter(project=project)
        .order_by("user__username")
    )

    # current user's role in this project
    if is_admin(user):
        my_role = "ADMIN"
    elif getattr(project, "evaluator_id", None) == user.id and is_evaluator(user):
        my_role = "EVALUATOR"
    else:
        my_role = "DEVELOPER"

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description or "",
            "similarityThreshold": float(project.similarity_threshold),
            "evaluator": {
                "id": project.evaluator_id,
                "username": project.evaluator.username if getattr(project, "evaluator", None) else None,
                "email": project.evaluator.email if getattr(project, "evaluator", None) else None,
            } if getattr(project, "evaluator_id", None) else None,
        },
        "membership": {"role": my_role},
        "activeUploads": {
            "activeBpmn": _json_file_payload(active_bpmn),
            "activeCode": _json_file_payload(active_code),
            "latestBpmn": _json_file_payload(latest_bpmn),
            "latestCode": _json_file_payload(latest_code),
        },
        "counts": {
            "codeFiles": code_files_count,
            "tasks": tasks_count,
            "matches": matches_count,
        },
        "runs": [
            {
                "id": r.id,
                "status": r.status,
                "startedAt": r.started_at.isoformat() if r.started_at else None,
                "finishedAt": r.finished_at.isoformat() if r.finished_at else None,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
                "errorMessage": r.error_message,
            }
            for r in runs
        ],
        "members": [
            {
                "id": m.id,
                "username": m.user.username,
                "email": m.user.email,
                "role": getattr(m, "role", "DEVELOPER"),
            }
            for m in members
        ],
    }


# ---------------------------
# Projects: list + create
# ---------------------------
@login_required
@require_http_methods(["GET", "POST"])
def api_projects_list_create(request):
    # GET: list projects visible to current user
    if request.method == "GET":
        if is_admin(request.user):
            projects = Project.objects.all().order_by("-created_at")
            data = [_json_project_summary(p, request.user) for p in projects]
            return JsonResponse(data, safe=False)

        if is_evaluator(request.user):
            projects = Project.objects.filter(evaluator=request.user).order_by("-created_at")
            data = [_json_project_summary(p, request.user) for p in projects]
            return JsonResponse(data, safe=False)

        # developer projects by membership
        projects = Project.objects.filter(memberships__user=request.user).distinct().order_by("-created_at")
        data = [_json_project_summary(p, request.user) for p in projects]
        return JsonResponse(data, safe=False)

    # POST: create project (ADMIN ONLY) with evaluator + developers chosen
    if not is_admin(request.user):
        return JsonResponse({"detail": "Only admin can create projects."}, status=403)

    name = (request.POST.get("name") or "").strip()
    description = (request.POST.get("description") or "").strip()
    threshold = (request.POST.get("similarity_threshold") or "0.6").strip()

    evaluator_email = (request.POST.get("evaluatorEmail") or "").strip().lower()
    developer_emails_raw = (request.POST.get("developerEmails") or "").strip()
    developer_emails = [e.strip().lower() for e in developer_emails_raw.split(",") if e.strip()]

    if not name:
        return JsonResponse({"detail": "Project name is required."}, status=400)

    if not evaluator_email:
        return JsonResponse({"detail": "evaluatorEmail is required."}, status=400)

    try:
        threshold_value = float(threshold)
        if threshold_value <= 0 or threshold_value >= 1:
            raise ValueError()
    except Exception:
        return JsonResponse({"detail": "Threshold must be between 0 and 1 (e.g., 0.6)."}, status=400)

    evaluator = (
        User.objects.filter(username=evaluator_email).first()
        or User.objects.filter(email=evaluator_email).first()
    )
    if not evaluator:
        return JsonResponse({"detail": "Evaluator user not found."}, status=404)

    # Enforce evaluator system role
    if not is_evaluator(evaluator):
        return JsonResponse({"detail": "Selected user is not an evaluator."}, status=400)

    project = Project.objects.create(
        name=name,
        description=description,
        created_by=request.user,   # admin creates it
        evaluator=evaluator,       # admin assigns evaluator
        similarity_threshold=threshold_value,
    )

    # Add developers (skip invalid / skip evaluator)
    for email in developer_emails:
        dev = User.objects.filter(username=email).first() or User.objects.filter(email=email).first()
        if not dev:
            continue
        if dev.id == evaluator.id:
            continue

        # Optional enforce DEVELOPER role if you have UserProfile
        profile = getattr(dev, "profile", None)
        if profile and getattr(profile, "role", None) != "DEVELOPER":
            continue

        ProjectMembership.objects.get_or_create(project=project, user=dev)

    return JsonResponse(_json_project_summary(project, request.user), status=201)


# ---------------------------
# Project detail + delete (SAME URL)
# ---------------------------
@login_required
@require_http_methods(["GET", "DELETE"])
def api_project_detail_or_delete(request, project_id: int):
    """
    GET: allowed for admin / assigned evaluator / developer member
    DELETE: ADMIN ONLY

    NOTE: This solves the 405 you saw because /api/projects/<id>/ now supports DELETE
    (instead of hitting GET-only api_project_detail).
    """
    project = get_object_or_404(Project, id=project_id)

    # DELETE
    if request.method == "DELETE":
        if not is_admin(request.user):
            return JsonResponse({"detail": "Admin only."}, status=403)
        project.delete()
        return JsonResponse({"ok": True})

    # GET
    if not _can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    return JsonResponse(_json_project_detail(project, request.user))


# ---------------------------
# Members (developers management)
# Only evaluator of this project OR admin
# ---------------------------
@login_required
@require_http_methods(["GET", "POST"])
def api_project_members(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not _is_project_evaluator(project, request.user):
        return JsonResponse({"detail": "Only evaluator can manage members."}, status=403)

    if request.method == "GET":
        members = (
            ProjectMembership.objects
            .select_related("user")
            .filter(project=project)
            .order_by("user__username")
        )
        return JsonResponse({
            "projectId": project.id,
            "members": [
                {
                    "id": m.id,
                    "username": m.user.username,
                    "email": m.user.email,
                    "role": getattr(m, "role", "DEVELOPER"),
                }
                for m in members
            ],
            "evaluator": {
                "id": project.evaluator_id,
                "username": project.evaluator.username if project.evaluator_id else None,
                "email": project.evaluator.email if project.evaluator_id else None,
            } if project.evaluator_id else None,
        })

    # POST: add developer by email
    email = (request.POST.get("email") or "").strip().lower()
    if not email:
        return JsonResponse({"detail": "Enter an email."}, status=400)

    user = User.objects.filter(username=email).first() or User.objects.filter(email=email).first()
    if not user:
        return JsonResponse({"detail": "No user found with that email."}, status=404)

    # don't add evaluator as developer
    if user.id == project.evaluator_id:
        return JsonResponse({"detail": "This user is already the evaluator."}, status=400)

    existing = ProjectMembership.objects.filter(project=project, user=user).first()
    if existing:
        return JsonResponse({"detail": "User is already a member."}, status=400)

    m = ProjectMembership.objects.create(project=project, user=user)
    return JsonResponse(
        {"id": m.id, "username": user.username, "email": user.email, "role": getattr(m, "role", "DEVELOPER")},
        status=201
    )


@login_required
@require_POST
def api_remove_member(request, project_id: int, membership_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not _is_project_evaluator(project, request.user):
        return JsonResponse({"detail": "Only evaluator can manage members."}, status=403)

    membership = get_object_or_404(ProjectMembership, id=membership_id, project=project)
    membership.delete()
    return JsonResponse({"ok": True})


# ---------------------------
# Logs
# ---------------------------
@login_required
@require_http_methods(["GET"])
def api_project_logs(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not _is_project_evaluator(project, request.user):
        return JsonResponse({"detail": "Only evaluator can view upload logs."}, status=403)

    logs = (
        ProjectFile.objects
        .filter(project=project)
        .select_related("uploaded_by")
        .order_by("-created_at")[:200]
    )

    return JsonResponse({
        "projectId": project.id,
        "logs": [
            {
                "id": f.id,
                "fileType": f.file_type,
                "originalName": f.original_name,
                "uploadedBy": f.uploaded_by.username if f.uploaded_by else None,
                "createdAt": f.created_at.isoformat() if f.created_at else None,
            }
            for f in logs
        ]
    })


# ---------------------------
# Settings: threshold
# ---------------------------
@login_required
@require_POST
def api_update_threshold(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not _is_project_evaluator(project, request.user):
        return JsonResponse({"detail": "Only evaluator can update settings."}, status=403)

    value = (request.POST.get("similarity_threshold") or "").strip()
    try:
        v = float(value)
        if v <= 0 or v >= 1:
            raise ValueError()
        project.similarity_threshold = v
        project.save(update_fields=["similarity_threshold"])
        return JsonResponse({"ok": True, "similarityThreshold": float(project.similarity_threshold)})
    except Exception:
        return JsonResponse({"detail": "Invalid threshold. Use 0..1 (e.g., 0.6)."}, status=400)


# ---------------------------
# Uploads
# ---------------------------
@login_required
@require_POST
def api_upload_bpmn(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not _is_project_evaluator(project, request.user):
        return JsonResponse({"detail": "Only evaluator can upload BPMN."}, status=403)

    f = request.FILES.get("bpmn_file")
    if not f:
        return JsonResponse({"detail": "Missing bpmn_file."}, status=400)

    try:
        save_bpmn_file(project, f, request.user)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"detail": f"BPMN upload failed: {e}"}, status=400)


@login_required
@require_POST
def api_upload_code_zip(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not _can_open_project(project, request.user):
        return JsonResponse({"detail": "Only project members can upload code ZIP."}, status=403)

    z = request.FILES.get("code_zip")
    if not z:
        return JsonResponse({"detail": "Missing code_zip."}, status=400)

    try:
        save_code_zip_and_extract(project, z, request.user)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"detail": f"Code ZIP upload failed: {e}"}, status=400)


# ---------------------------
# Run analysis
# ---------------------------
@login_required
@require_POST
def api_run_analysis(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not _can_open_project(project, request.user):
        return JsonResponse({"detail": "Only project members can run analysis."}, status=403)

    if not project.active_bpmn:
        return JsonResponse({"detail": "Upload BPMN first (Evaluator)."}, status=400)

    if not project.active_code:
        return JsonResponse({"detail": "Upload Code ZIP first."}, status=400)

    try:
        run = run_analysis_for_project(project, matcher="greedy", top_k=3)
        return JsonResponse({
            "run": {
                "id": run.id,
                "status": run.status,
                "errorMessage": run.error_message,
            }
        })
    except Exception as e:
        return JsonResponse({"detail": f"Analysis failed: {e}"}, status=400)


# ---------------------------
# Data endpoints
# ---------------------------
@login_required
def api_project_files(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    files = list(project.code_files.values("relative_path", "ext", "size_bytes"))
    return JsonResponse({"project_id": project.id, "files": files})


@login_required
def api_project_tasks(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    tasks = list(project.bpmn_tasks.values("task_id", "name", "description"))
    return JsonResponse({"project_id": project.id, "tasks": tasks})


@login_required
def api_project_matches(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    matches = []
    for m in project.match_results.select_related("task").all():
        matches.append({
            "status": m.status,
            "similarity_score": m.similarity_score,
            "task": {
                "task_id": m.task.task_id,
                "name": m.task.name,
            } if m.task else None,
            "code_ref": m.code_ref,
        })

    return JsonResponse({"project_id": project.id, "matches": matches})