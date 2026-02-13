# apps/api/projects_api.py
from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods, require_POST

from apps.analysis.models import AnalysisRun, BpmnTask, MatchResult
from apps.analysis.services import run_analysis_for_project
from apps.projects.models import Project, ProjectMembership, CodeFile, ProjectFile
from apps.projects.services import save_bpmn_file, save_code_zip_and_extract


# ---------------------------
# Permissions helpers
# ---------------------------
def _get_membership(project: Project, user: User):
    return ProjectMembership.objects.filter(project=project, user=user).first()


def _require_member(project: Project, user: User):
    return _get_membership(project, user)


def _require_evaluator(project: Project, user: User):
    m = _get_membership(project, user)
    if not m or m.role != ProjectMembership.Role.EVALUATOR:
        return None
    return m


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
def _json_project_summary(p: Project, membership: ProjectMembership | None = None):
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description or "",
        "similarityThreshold": float(p.similarity_threshold),
        "membership": {"role": membership.role} if membership else None,
    }


def _json_file_payload(f: ProjectFile | None):
    if not f:
        return None
    return {
        "id": f.id,
        "originalName": f.original_name,
        "createdAt": f.created_at.isoformat() if f.created_at else None,
        "uploadedBy": f.uploaded_by.username if f.uploaded_by else None,
    }


def _json_project_detail(project: Project, membership: ProjectMembership):
    active_bpmn = project.active_bpmn
    active_code = project.active_code

    latest_bpmn = _latest_file(project, "BPMN")
    latest_code = _latest_file(project, "CODE")

    code_files_count = CodeFile.objects.filter(project=project).count()
    tasks_count = BpmnTask.objects.filter(project=project).count()
    matches_count = MatchResult.objects.filter(project=project).count()

    runs = AnalysisRun.objects.filter(project=project).order_by("-created_at")[:10]

    members = (
        ProjectMembership.objects
        .select_related("user")
        .filter(project=project)
        .order_by("role", "user__username")
    )

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description or "",
            "similarityThreshold": float(project.similarity_threshold),
        },
        "membership": {"role": membership.role},
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
                "role": m.role,
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
    # GET: list projects where current user is a member
    if request.method == "GET":
        memberships = (
            ProjectMembership.objects
            .select_related("project")
            .filter(user=request.user)
            .order_by("-project__created_at")
        )
        data = [_json_project_summary(m.project, m) for m in memberships]
        return JsonResponse(data, safe=False)

    # POST: create project
    name = (request.POST.get("name") or "").strip()
    description = (request.POST.get("description") or "").strip()
    threshold = (request.POST.get("similarity_threshold") or "0.6").strip()

    if not name:
        return JsonResponse({"detail": "Project name is required."}, status=400)

    try:
        threshold_value = float(threshold)
        if threshold_value <= 0 or threshold_value >= 1:
            raise ValueError()
    except Exception:
        return JsonResponse({"detail": "Threshold must be between 0 and 1 (e.g., 0.6)."}, status=400)

    project = Project.objects.create(
        name=name,
        description=description,
        created_by=request.user,
        similarity_threshold=threshold_value,
    )

    membership = ProjectMembership.objects.create(
        project=project,
        user=request.user,
        role=ProjectMembership.Role.EVALUATOR,
    )

    return JsonResponse(_json_project_summary(project, membership), status=201)


# ---------------------------
# Project detail
# ---------------------------
@login_required
@require_http_methods(["GET"])
def api_project_detail(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    membership = _require_member(project, request.user)
    if not membership:
        return JsonResponse({"detail": "Forbidden"}, status=403)
    return JsonResponse(_json_project_detail(project, membership))


# ---------------------------
# Members
# ---------------------------
@login_required
@require_http_methods(["GET", "POST"])
def api_project_members(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not _require_evaluator(project, request.user):
        return JsonResponse({"detail": "Only evaluator can manage members."}, status=403)

    if request.method == "GET":
        members = (
            ProjectMembership.objects
            .select_related("user")
            .filter(project=project)
            .order_by("role", "user__username")
        )
        return JsonResponse({
            "projectId": project.id,
            "members": [
                {"id": m.id, "username": m.user.username, "email": m.user.email, "role": m.role}
                for m in members
            ]
        })

    email = (request.POST.get("email") or "").strip().lower()
    if not email:
        return JsonResponse({"detail": "Enter an email."}, status=400)

    user = User.objects.filter(username=email).first() or User.objects.filter(email=email).first()
    if not user:
        return JsonResponse({"detail": "No user found with that email."}, status=404)

    existing = ProjectMembership.objects.filter(project=project, user=user).first()
    if existing:
        return JsonResponse({"detail": "User is already a member."}, status=400)

    m = ProjectMembership.objects.create(project=project, user=user, role=ProjectMembership.Role.DEVELOPER)
    return JsonResponse({"id": m.id, "username": user.username, "email": user.email, "role": m.role}, status=201)


@login_required
@require_POST
def api_remove_member(request, project_id: int, membership_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not _require_evaluator(project, request.user):
        return JsonResponse({"detail": "Only evaluator can manage members."}, status=403)

    membership = get_object_or_404(ProjectMembership, id=membership_id, project=project)

    if membership.role == ProjectMembership.Role.EVALUATOR:
        return JsonResponse({"detail": "Cannot remove evaluator."}, status=400)

    membership.delete()
    return JsonResponse({"ok": True})


# ---------------------------
# Logs
# ---------------------------
@login_required
@require_http_methods(["GET"])
def api_project_logs(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not _require_evaluator(project, request.user):
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

    if not _require_evaluator(project, request.user):
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

    if not _require_evaluator(project, request.user):
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

    if not _require_member(project, request.user):
        return JsonResponse({"detail": "Only members can upload code ZIP."}, status=403)

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

    if not _require_member(project, request.user):
        return JsonResponse({"detail": "Only members can run analysis."}, status=403)

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
    if not _require_member(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    files = list(project.code_files.values("relative_path", "ext", "size_bytes"))
    return JsonResponse({"project_id": project.id, "files": files})


@login_required
def api_project_tasks(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not _require_member(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    tasks = list(project.bpmn_tasks.values("task_id", "name", "description"))
    return JsonResponse({"project_id": project.id, "tasks": tasks})


@login_required
def api_project_matches(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not _require_member(project, request.user):
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
