# apps/projects/views.py
from pathlib import Path
from django.conf import settings
from apps.analysis.bpmn.pipeline import run_bpmn_predev
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods, require_POST

from apps.analysis.models import AnalysisRun, BpmnTask, MatchResult
from apps.analysis.services import run_analysis_for_project

from apps.accounts.rbac import is_admin, is_evaluator
from .models import Project, ProjectMembership, CodeFile, ProjectFile
from .services import save_bpmn_file, save_code_zip_and_extract


# ============================================================
# Permission helpers (Option 1)
# ============================================================

def _is_project_evaluator(project, user):
    # Admin can do everything
    if is_admin(user):
        return True
    # Evaluator can act only on projects assigned to him
    return is_evaluator(user) and getattr(project, "evaluator_id", None) == user.id


def _is_project_developer(project, user):
    # Admin can do everything
    if is_admin(user):
        return True
    # Developer = has membership row in that project
    return ProjectMembership.objects.filter(project=project, user=user).exists()


def _can_open_project(project, user):
    return _is_project_evaluator(project, user) or _is_project_developer(project, user)


# ============================================================
# Projects list
# ============================================================

@login_required
def projects_list(request):
    if is_admin(request.user):
        projects = Project.objects.all().order_by("-created_at")
    elif is_evaluator(request.user):
        projects = Project.objects.filter(evaluator=request.user).order_by("-created_at")
    else:
        projects = Project.objects.filter(memberships__user=request.user).distinct().order_by("-created_at")

    return render(request, "projects/project_list.html", {"projects": projects})


# ============================================================
# Project create (Admin only)
# Admin selects evaluator + developers (NO auto-assign creator)
# ============================================================

@login_required
@require_http_methods(["GET", "POST"])
def projects_create(request):
    if not is_admin(request.user):
        messages.error(request, "Admin only.")
        return redirect("projects:list")

    if request.method == "GET":
        evaluators = User.objects.filter(profile__role="EVALUATOR").order_by("username")
        developers = User.objects.filter(profile__role="DEVELOPER").order_by("username")
        return render(
            request,
            "projects/project_create.html",
            {
                "evaluators": evaluators,
                "developers": developers,
            },
        )

    name = (request.POST.get("name") or "").strip()
    description = (request.POST.get("description") or "").strip()
    threshold_raw = (request.POST.get("similarity_threshold") or "0.6").strip()
    evaluator_id = (request.POST.get("evaluator_id") or "").strip()
    developer_ids = request.POST.getlist("developer_ids")

    if not name:
        messages.error(request, "Project name is required.")
        return redirect("projects:create")

    try:
        threshold = float(threshold_raw)
        if threshold <= 0 or threshold >= 1:
            raise ValueError()
    except Exception:
        messages.error(request, "Threshold must be a number between 0 and 1 (e.g., 0.6).")
        return redirect("projects:create")

    if not evaluator_id:
        messages.error(request, "Please select an evaluator.")
        return redirect("projects:create")

    evaluator = get_object_or_404(User, id=evaluator_id)

    # Create project: created_by is admin, evaluator is chosen (no auto role assignment)
    project = Project.objects.create(
        name=name,
        description=description,
        created_by=request.user,
        evaluator=evaluator,
        similarity_threshold=threshold,
    )

    # Add developers chosen by admin
    for dev_id in developer_ids:
        dev_id = (dev_id or "").strip()
        if not dev_id:
            continue

        dev = User.objects.filter(id=dev_id).first()
        if not dev:
            continue

        # prevent adding evaluator as developer if chosen mistakenly
        if dev.id == evaluator.id:
            continue

        ProjectMembership.objects.get_or_create(project=project, user=dev)

    messages.success(request, "Project created.")
    return redirect("projects:detail", project_id=project.id)


# ============================================================
# Project detail
# ============================================================

@login_required
def projects_detail(request, project_id):
    project = get_object_or_404(Project, id=project_id)

    if not _can_open_project(project, request.user):
        messages.error(request, "Access denied.")
        return redirect("projects:list")

    runs = AnalysisRun.objects.filter(project=project).order_by("-created_at")[:10]

    return render(
        request,
        "projects/project_detail.html",
        {
            "project": project,
            "runs": runs,
            "active_bpmn": project.active_bpmn,
            "active_code": project.active_code,
            "code_files_count": CodeFile.objects.filter(project=project).count(),
            "tasks_count": BpmnTask.objects.filter(project=project).count(),
            "matches_count": MatchResult.objects.filter(project=project).count(),
        },
    )


# ============================================================
# Upload BPMN (Evaluator for this project OR Admin)
# ============================================================

@login_required
@require_POST
def upload_bpmn(request, project_id):
    """
    Evaluator-only:
    - Upload BPMN file
    - Run pre-development stage (well-formed check + T5 summary)
    - Store results on ProjectFile
    - Reject invalid BPMN
    """
    project = get_object_or_404(Project, id=project_id)

    if not _is_project_evaluator(project, request.user):
        messages.error(request, "Evaluator only.")
        return redirect("projects:detail", project_id=project.id)

    uploaded_file = request.FILES.get("bpmn_file")
    if not uploaded_file:
        messages.error(request, "Please choose a BPMN/XML file.")
        return redirect("projects:detail", project_id=project.id)

    try:
        #  Save file (creates ProjectFile + sets active_bpmn)
        pf = save_bpmn_file(project, uploaded_file, request.user)

        #  Read file bytes
        bpmn_abs = Path(settings.MEDIA_ROOT) / pf.stored_path
        bpmn_bytes = bpmn_abs.read_bytes()

        #  Run pre-development stage
        predev = run_bpmn_predev(bpmn_bytes, do_summary=True)

        #  Store precheck + summary results
        pf.is_well_formed = bool(predev["ok"])
        pf.precheck_errors = predev.get("errors", [])
        pf.precheck_warnings = predev.get("warnings", [])
        pf.bpmn_summary = predev.get("summary", "")
        pf.save(update_fields=[
            "is_well_formed",
            "precheck_errors",
            "precheck_warnings",
            "bpmn_summary",
        ])

        #  If invalid → unset active BPMN and stop
        if not predev["ok"]:
            project.active_bpmn = None
            project.save(update_fields=["active_bpmn"])

            messages.error(request, "BPMN upload failed: Invalid BPMN/XML file.")
            for err in (predev.get("errors") or [])[:5]:
                messages.error(request, err)

            return redirect("projects:detail", project_id=project.id)

        #  If valid → show warnings if any
        if predev.get("warnings"):
            messages.warning(request, "BPMN uploaded with warnings.")
            for w in (predev["warnings"] or [])[:3]:
                messages.warning(request, w)

        messages.success(
            request,
            "BPMN uploaded successfully (Pre-check + summary generated)"
        )

    except Exception as e:
        messages.error(request, f"BPMN upload failed: {e}")

    return redirect("projects:detail", project_id=project.id)


# ============================================================
# Upload Code (Project members OR Admin)
# ============================================================

@login_required
@require_POST
def upload_code_zip(request, project_id):
    project = get_object_or_404(Project, id=project_id)

    if not _can_open_project(project, request.user):
        messages.error(request, "Access denied.")
        return redirect("projects:list")

    z = request.FILES.get("code_zip")
    if not z:
        messages.error(request, "Please choose a ZIP file.")
        return redirect("projects:detail", project_id=project.id)

    try:
        save_code_zip_and_extract(project, z, request.user)
        messages.success(request, "Code uploaded.")
    except Exception as e:
        messages.error(request, f"Code upload failed: {e}")

    return redirect("projects:detail", project_id=project.id)


# ============================================================
# Run Analysis (Project members OR Admin)
# ============================================================

@login_required
@require_POST
def run_analysis(request, project_id):
    project = get_object_or_404(Project, id=project_id)

    if not _can_open_project(project, request.user):
        messages.error(request, "Access denied.")
        return redirect("projects:list")

    if not project.active_bpmn:
        messages.error(request, "Upload BPMN first (Evaluator).")
        return redirect("projects:detail", project_id=project.id)

    if not project.active_code:
        messages.error(request, "Upload Code ZIP first.")
        return redirect("projects:detail", project_id=project.id)

    # ✅ Block analysis if BPMN precheck failed (pre-dev stage)
    if hasattr(project.active_bpmn, "is_well_formed") and not project.active_bpmn.is_well_formed:
        messages.error(request, "Active BPMN is invalid. Upload a valid BPMN first.")
        # show a couple of reasons if available
        errs = getattr(project.active_bpmn, "precheck_errors", None) or []
        for e in errs[:3]:
            messages.error(request, e)
        return redirect("projects:detail", project_id=project.id)

    try:
        run_analysis_for_project(project)
        messages.success(request, "Analysis started.")
    except Exception as e:
        messages.error(request, f"Analysis failed: {e}")

    return redirect("projects:detail", project_id=project.id)
# ============================================================
# JSON endpoints (Project members OR Admin)
# ============================================================

@login_required
def project_files(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    files = list(project.code_files.values("relative_path", "ext", "size_bytes"))
    return JsonResponse({"files": files})


@login_required
def project_tasks(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    tasks = list(project.bpmn_tasks.values("task_id", "name", "description"))
    return JsonResponse({"tasks": tasks})


@login_required
def project_matches(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    matches = list(project.match_results.values("status", "similarity_score", "code_ref"))
    return JsonResponse({"matches": matches})


# ============================================================
# Logs (Evaluator for this project OR Admin)
# ============================================================

@login_required
def upload_logs(request, project_id):
    project = get_object_or_404(Project, id=project_id)

    if not _is_project_evaluator(project, request.user):
        messages.error(request, "Evaluator only.")
        return redirect("projects:detail", project_id=project.id)

    logs = ProjectFile.objects.filter(project=project).order_by("-created_at")
    return render(request, "projects/upload_logs.html", {"project": project, "logs": logs})


# ============================================================
# Threshold update (Evaluator for this project OR Admin)
# ============================================================

@login_required
@require_POST
def update_threshold(request, project_id):
    project = get_object_or_404(Project, id=project_id)

    if not _is_project_evaluator(project, request.user):
        messages.error(request, "Evaluator only.")
        return redirect("projects:detail", project_id=project.id)

    threshold_raw = (request.POST.get("similarity_threshold") or "0.6").strip()
    try:
        value = float(threshold_raw)
        if value <= 0 or value >= 1:
            raise ValueError()
    except Exception:
        messages.error(request, "Invalid threshold. Use a number between 0 and 1 (e.g., 0.6).")
        return redirect("projects:detail", project_id=project.id)

    project.similarity_threshold = value
    project.save(update_fields=["similarity_threshold"])

    messages.success(request, "Threshold updated.")
    return redirect("projects:detail", project_id=project.id)


# ============================================================
# Members management (developers only)
# Only evaluator for this project (or admin) can manage
# ============================================================

@login_required
@require_http_methods(["GET", "POST"])
def project_members(request, project_id):
    project = get_object_or_404(Project, id=project_id)

    if not _is_project_evaluator(project, request.user):
        messages.error(request, "Evaluator only.")
        return redirect("projects:detail", project_id=project.id)

    members = ProjectMembership.objects.filter(project=project).select_related("user").order_by("user__username")

    if request.method == "POST":
        email = (request.POST.get("email") or "").strip().lower()
        if not email:
            messages.error(request, "Enter a user email.")
            return redirect("projects:members", project_id=project.id)

        user = User.objects.filter(username=email).first() or User.objects.filter(email=email).first()
        if user:
            # prevent adding evaluator as developer
            if user.id == project.evaluator_id:
                messages.error(request, "This user is the evaluator already.")
            else:
                ProjectMembership.objects.get_or_create(project=project, user=user)
                messages.success(request, "Developer added.")
        else:
            messages.error(request, "User not found.")

        return redirect("projects:members", project_id=project.id)

    return render(request, "projects/project_members.html", {"project": project, "members": members})


@login_required
@require_POST
def remove_member(request, project_id, membership_id):
    project = get_object_or_404(Project, id=project_id)

    if not _is_project_evaluator(project, request.user):
        messages.error(request, "Evaluator only.")
        return redirect("projects:detail", project_id=project.id)

    membership = get_object_or_404(ProjectMembership, id=membership_id, project=project)
    membership.delete()

    messages.success(request, "Member removed.")
    return redirect("projects:members", project_id=project.id)