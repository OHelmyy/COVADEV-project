# apps/projects/views.py

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods, require_POST

from apps.analysis.models import AnalysisRun, BpmnTask, MatchResult
from apps.analysis.services import run_analysis_for_project

from .models import Project, ProjectMembership, CodeFile, ProjectFile
from .services import save_bpmn_file, save_code_zip_and_extract


# ============================================================
# Helpers: membership / authorization
# ============================================================

def _get_membership(project: Project, user: User):
    """Return ProjectMembership if exists, otherwise None."""
    return ProjectMembership.objects.filter(project=project, user=user).first()


def _require_member(project: Project, user: User):
    """Require user to be a member (evaluator or developer)."""
    return _get_membership(project, user)


def _require_evaluator(project: Project, user: User):
    """Require user to be evaluator in this project."""
    m = _get_membership(project, user)
    if not m or m.role != ProjectMembership.Role.EVALUATOR:
        return None
    return m


def _latest_file(project: Project, file_type: str):
    """Return latest uploaded ProjectFile of a given type for the project."""
    return (
        ProjectFile.objects
        .filter(project=project, file_type=file_type)
        .select_related("uploaded_by")
        .order_by("-created_at")
        .first()
    )


# ============================================================
# Pages: list / create / detail
# ============================================================

@login_required
def projects_list(request):
    """List only projects where the current user is a member."""
    memberships = (
        ProjectMembership.objects
        .select_related("project")
        .filter(user=request.user)
        .order_by("-project__created_at")
    )
    projects = [m.project for m in memberships]
    return render(request, "projects/project_list.html", {"projects": projects})


@login_required
@require_http_methods(["GET", "POST"])
def projects_create(request):
    """
    Create a project.
    The creator automatically becomes the Evaluator for this project.
    """
    if request.method == "GET":
        return render(request, "projects/project_create.html")

    name = (request.POST.get("name") or "").strip()
    description = (request.POST.get("description") or "").strip()
    threshold = (request.POST.get("similarity_threshold") or "0.6").strip()

    if not name:
        messages.error(request, "Project name is required.")
        return redirect("projects:create")

    try:
        threshold_value = float(threshold)
        if threshold_value <= 0 or threshold_value >= 1:
            raise ValueError()
    except Exception:
        messages.error(request, "Threshold must be a number between 0 and 1 (e.g., 0.6).")
        return redirect("projects:create")

    project = Project.objects.create(
        name=name,
        description=description,
        created_by=request.user,
        similarity_threshold=threshold_value,
    )

    ProjectMembership.objects.create(
        project=project,
        user=request.user,
        role=ProjectMembership.Role.EVALUATOR,
    )

    messages.success(request, "Project created.")
    return redirect("projects:detail", project_id=project.id)


@login_required
def projects_detail(request, project_id):
    """
    Project screen (no versions):
    - shows active BPMN + active Code ZIP
    - shows counts of indexed files/tasks/matches
    - shows latest analysis runs
    - members list
    """
    project = get_object_or_404(Project, id=project_id)

    membership = _require_member(project, request.user)
    if not membership:
        messages.error(request, "You do not have access to this project.")
        return redirect("projects:list")

    # Active uploads (also useful for UI display)
    active_bpmn = project.active_bpmn
    active_code = project.active_code

    # You can also show last uploaded file names even if not active for any reason
    latest_bpmn = _latest_file(project, "BPMN")
    latest_code = _latest_file(project, "CODE")

    # Counts are project-based now
    code_files_count = CodeFile.objects.filter(project=project).count()
    tasks_count = BpmnTask.objects.filter(project=project).count()
    matches_count = MatchResult.objects.filter(project=project).count()

    # Latest analysis runs for this project
    runs = AnalysisRun.objects.filter(project=project).order_by("-created_at")[:10]

    members = (
        ProjectMembership.objects
        .select_related("user")
        .filter(project=project)
        .order_by("role", "user__username")
    )

    return render(
        request,
        "projects/project_detail.html",
        {
            "project": project,
            "membership": membership,
            "members": members,

            "active_bpmn": active_bpmn,
            "active_code": active_code,
            "latest_bpmn": latest_bpmn,
            "latest_code": latest_code,

            "runs": runs,
            "code_files_count": code_files_count,
            "tasks_count": tasks_count,
            "matches_count": matches_count,
        },
    )


# ============================================================
# Upload actions
# - BPMN: evaluator only
# - Code ZIP: any member (evaluator or developer)
# ============================================================

@login_required
@require_POST
def upload_bpmn(request, project_id):
    """Evaluator-only: upload BPMN and set it as project.active_bpmn."""
    project = get_object_or_404(Project, id=project_id)

    if not _require_evaluator(project, request.user):
        messages.error(request, "Only evaluator can upload BPMN.")
        return redirect("projects:detail", project_id=project.id)

    f = request.FILES.get("bpmn_file")
    if not f:
        messages.error(request, "Please choose a BPMN/XML file.")
        return redirect("projects:detail", project_id=project.id)

    try:
        save_bpmn_file(project, f, request.user)
        messages.success(request, "BPMN uploaded successfully.")
    except Exception as e:
        messages.error(request, f"BPMN upload failed: {e}")

    return redirect("projects:detail", project_id=project.id)


@login_required
@require_POST
def upload_code_zip(request, project_id):
    """Any member: upload code ZIP, extract/index, and set it as project.active_code."""
    project = get_object_or_404(Project, id=project_id)

    if not _require_member(project, request.user):
        messages.error(request, "Only project members can upload code ZIP.")
        return redirect("projects:list")

    z = request.FILES.get("code_zip")
    if not z:
        messages.error(request, "Please choose a ZIP file.")
        return redirect("projects:detail", project_id=project.id)

    try:
        save_code_zip_and_extract(project, z, request.user)
        messages.success(request, "Code ZIP uploaded and indexed.")
    except Exception as e:
        messages.error(request, f"Code ZIP upload failed: {e}")

    return redirect("projects:detail", project_id=project.id)


# ============================================================
# Analysis action: run analysis
# Any member can run analysis (as you requested)
# ============================================================

@login_required
@require_POST
def run_analysis(request, project_id):
    project = get_object_or_404(Project, id=project_id)

    if not _require_member(project, request.user):
        messages.error(request, "Only project members can run analysis.")
        return redirect("projects:list")

    if not project.active_bpmn:
        messages.error(request, "Upload BPMN first (Evaluator).")
        return redirect("projects:detail", project_id=project.id)

    if not project.active_code:
        messages.error(request, "Upload Code ZIP first.")
        return redirect("projects:detail", project_id=project.id)

    try:
        run_analysis_for_project(project)
        messages.success(request, "Analysis started.")
    except Exception as e:
        messages.error(request, f"Analysis failed: {e}")

    return redirect("projects:detail", project_id=project.id)


# ============================================================
# JSON API: project assets (files / tasks / matches)
# Any member can view
# ============================================================

@login_required
def project_files(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not _require_member(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    files = list(project.code_files.values("relative_path", "ext", "size_bytes"))
    return JsonResponse({"project_id": project.id, "files": files})


@login_required
def project_tasks(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not _require_member(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    tasks = list(project.bpmn_tasks.values("task_id", "name", "description"))
    return JsonResponse({"project_id": project.id, "tasks": tasks})


@login_required
def project_matches(request, project_id):
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


# ============================================================
# Upload logs (evaluator only)
# ============================================================

@login_required
def upload_logs(request, project_id):
    project = get_object_or_404(Project, id=project_id)

    if not _require_evaluator(project, request.user):
        messages.error(request, "Only evaluator can view upload logs.")
        return redirect("projects:detail", project_id=project.id)

    logs = (
        ProjectFile.objects
        .filter(project=project)
        .select_related("uploaded_by")
        .order_by("-created_at")[:200]
    )

    return render(request, "projects/upload_logs.html", {"project": project, "logs": logs})


# ============================================================
# Project settings: similarity threshold (evaluator only)
# ============================================================

@login_required
@require_POST
def update_threshold(request, project_id):
    project = get_object_or_404(Project, id=project_id)

    if not _require_evaluator(project, request.user):
        messages.error(request, "Only the evaluator can update settings.")
        return redirect("projects:detail", project_id=project.id)

    value = (request.POST.get("similarity_threshold") or "").strip()
    try:
        v = float(value)
        if v <= 0 or v >= 1:
            raise ValueError()
        project.similarity_threshold = v
        project.save(update_fields=["similarity_threshold"])
        messages.success(request, "Similarity threshold updated.")
    except Exception:
        messages.error(request, "Invalid threshold. Use a number between 0 and 1 (e.g., 0.6).")

    return redirect("projects:detail", project_id=project.id)


# ============================================================
# Members management: add/remove developers (evaluator only)
# ============================================================

@login_required
@require_http_methods(["GET", "POST"])
def project_members(request, project_id):
    project = get_object_or_404(Project, id=project_id)

    if not _require_evaluator(project, request.user):
        messages.error(request, "Only the evaluator can manage project members.")
        return redirect("projects:detail", project_id=project.id)

    members = (
        ProjectMembership.objects
        .select_related("user")
        .filter(project=project)
        .order_by("role", "user__username")
    )

    if request.method == "GET":
        return render(request, "projects/project_members.html", {"project": project, "members": members})

    # POST: add developer by email (or username)
    email = (request.POST.get("email") or "").strip().lower()
    if not email:
        messages.error(request, "Enter an email.")
        return redirect("projects:members", project_id=project.id)

    user = User.objects.filter(username=email).first() or User.objects.filter(email=email).first()
    if not user:
        messages.error(request, "No user found with that email.")
        return redirect("projects:members", project_id=project.id)

    existing = ProjectMembership.objects.filter(project=project, user=user).first()
    if existing:
        messages.error(request, "This user is already a member of the project.")
        return redirect("projects:members", project_id=project.id)

    ProjectMembership.objects.create(project=project, user=user, role=ProjectMembership.Role.DEVELOPER)
    messages.success(request, "Developer added to project.")
    return redirect("projects:members", project_id=project.id)


@login_required
@require_POST
def remove_member(request, project_id, membership_id):
    project = get_object_or_404(Project, id=project_id)

    if not _require_evaluator(project, request.user):
        messages.error(request, "Only the evaluator can manage project members.")
        return redirect("projects:detail", project_id=project.id)

    membership = get_object_or_404(ProjectMembership, id=membership_id, project=project)

    # Single-evaluator rule: don't remove evaluator
    if membership.role == ProjectMembership.Role.EVALUATOR:
        messages.error(request, "You cannot remove the evaluator.")
        return redirect("projects:members", project_id=project.id)

    membership.delete()
    messages.success(request, "Member removed.")
    return redirect("projects:members", project_id=project.id)
