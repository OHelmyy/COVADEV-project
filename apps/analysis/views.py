# apps/analysis/views.py
#
# ✅ Edited to work with Option 1 RBAC (Admin / Evaluator / Developer)
# ✅ Protects ALL endpoints with login + project access checks
# ✅ Does NOT change the pipeline logic (services.py stays the same)
#
# Key rules used here:
# - Admin can access everything
# - Evaluator can access projects where project.evaluator == user
# - Developer can access projects where ProjectMembership exists
#
# IMPORTANT:
# - The prototype upload endpoint is kept but locked to ADMIN only (recommended).
#   If you don't need it, delete it entirely.

from __future__ import annotations
from django.contrib.auth.decorators import login_required
from apps.projects.models import ProjectMembership, ProjectFile, Project
from apps.analysis.models import AnalysisRun

import json
import traceback
import uuid
import zipfile
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods
from django.contrib.auth.decorators import login_required

from apps.accounts.rbac import is_admin, is_evaluator
from apps.projects.models import Project, ProjectMembership

from .bpmn.parser import extract_tasks
from .code.extractor import extract_python_from_directory
from .embeddings.pipeline import embed_pipeline
from .semantic.similarity import compute_similarity, top_k_matches
from .services import run_semantic_pipeline_for_project, compute_metrics_from_similarity_payload


# ============================================================
# Helpers
# ============================================================

def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _read_json(request) -> dict:
    if not request.body:
        return {}
    return json.loads(request.body.decode("utf-8"))


def _can_open_project(project: Project, user) -> bool:
    """
    Option 1 access rule:
      - Admin can open everything
      - Evaluator can open projects where project.evaluator == user
      - Developer can open if membership exists
    """
    if is_admin(user):
        return True

    if is_evaluator(user) and project.evaluator_id == user.id:
        return True

    return ProjectMembership.objects.filter(project=project, user=user).exists()


def _require_project_access(request, project_id: int) -> Project:
    """
    Resolve project and enforce access. Returns Project or raises 403 JsonResponse.
    """
    project = get_object_or_404(Project, id=project_id)

    if not _can_open_project(project, request.user):
        # raise a JsonResponse-style "forbidden"
        # caller should return it
        return None  # type: ignore

    return project


def _forbidden():
    return JsonResponse({"detail": "Forbidden"}, status=403)


# ============================================================
# ✅ Prototype upload endpoint (LOCKED)
# ============================================================

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def run_analysis(request):
    """
    ⚠️ Prototype endpoint for direct file upload pipeline.
    Recommended: ADMIN only (so random users can't upload code/bpmn here).

    multipart/form-data:
      - bpmn_file
      - code_zip
      - top_k (optional)
    """
    if not is_admin(request.user):
        return _forbidden()

    bpmn_file = request.FILES.get("bpmn_file")
    code_zip = request.FILES.get("code_zip")
    top_k = int(request.POST.get("top_k", "3") or "3")

    if not bpmn_file or not code_zip:
        return JsonResponse({"error": "bpmn_file and code_zip are required"}, status=400)

    run_id = uuid.uuid4().hex
    base_dir = Path(settings.MEDIA_ROOT) / "tmp_analysis" / run_id
    _ensure_dir(base_dir)

    bpmn_path = base_dir / bpmn_file.name
    zip_path = base_dir / code_zip.name
    code_dir = base_dir / "code"

    bpmn_path.write_bytes(bpmn_file.read())
    zip_path.write_bytes(code_zip.read())

    _ensure_dir(code_dir)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(code_dir)

    try:
        # NOTE: if your parser expects bytes, adapt accordingly
        tasks = extract_tasks(bpmn_path)  # your prototype uses path-based parser
        code_items = extract_python_from_directory(code_dir, project_root=code_dir)

        embedded = embed_pipeline(tasks=tasks, code_items=code_items, batch_size=32)
        similarity = compute_similarity(
            task_embeddings=embedded["task_embeddings"],
            code_embeddings=embedded["code_embeddings"],
        )

        topk = top_k_matches(similarity=similarity, k=top_k)

        return JsonResponse(
            {
                "meta": {**embedded["meta"], **similarity["meta"], "top_k": top_k},
                "counts": {"tasks": len(tasks), "code_items": len(code_items)},
                "tasks_preview": tasks[:30],
                "code_items_preview": code_items[:50],
                "topk": topk,
            },
            json_dumps_params={"ensure_ascii": False},
        )
    except Exception as e:
        return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)


# ============================================================
# ✅ Dashboard page (UI)
# ============================================================

@login_required
@require_GET
def dashboard(request):
    """
    If this is a global dashboard page, keep it accessible to logged-in users.
    Project-specific data should be loaded via the project endpoints below.
    """
    return render(request, "analysis/dashboard.html")


# ============================================================
# ✅ The endpoint your dashboard calls (PROJECT-BASED)
# ============================================================

@login_required
@require_GET
def run_project(request, project_id: int):
    """
    Returns the UI-ready payload for a specific project.
    This calls: run_semantic_pipeline_for_project(project_id, ...)

    Access:
      - Any user who can open the project (Admin, assigned evaluator, assigned developer)
    """
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    # default threshold to project threshold unless override is provided
    threshold = float(request.GET.get("threshold", project.similarity_threshold or 0.7))
    top_k = int(request.GET.get("top_k", 3))

    result = run_semantic_pipeline_for_project(project_id, threshold=threshold, top_k=top_k)

    # Attach pre-dev info stored on active_bpmn
    try:
        from apps.projects.models import Project
        project = Project.objects.select_related("active_bpmn").get(id=project_id)
        ab = project.active_bpmn
        result["bpmn_summary"] = (ab.bpmn_summary if ab else "") or ""
        result["precheck_warnings"] = (ab.precheck_warnings if ab else []) or []
        result["is_well_formed"] = bool(ab.is_well_formed) if ab else True
    except Exception:
        result["bpmn_summary"] = ""
        result["precheck_warnings"] = []
        result["is_well_formed"] = True

    return JsonResponse(result, safe=True, json_dumps_params={"ensure_ascii": False})


# ============================================================
# ✅ Metrics-from-payload endpoint (PROJECT-BASED)
# ============================================================

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def run_project_metrics(request, project_id: int):
    """
    Uses client payload (tasks/code/matches) to compute metrics.

    Access:
      - Any user who can open the project
    """
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    payload = _read_json(request)
    try:
        result = compute_metrics_from_similarity_payload(payload)
        return JsonResponse(result, safe=True, json_dumps_params={"ensure_ascii": False})
    except Exception as e:
        return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def metrics_summary(request, project_id: int):
    """
    Access:
      - Any user who can open the project
    """
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    payload = _read_json(request)
    try:
        result = compute_metrics_from_similarity_payload(payload)
        return JsonResponse(result["summary"], safe=True, json_dumps_params={"ensure_ascii": False})
    except Exception as e:
        return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def metrics_details(request, project_id: int):
    """
    Access:
      - Any user who can open the project
    """
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    payload = _read_json(request)
    try:
        result = compute_metrics_from_similarity_payload(payload)
        return JsonResponse(result["details"], safe=True, json_dumps_params={"ensure_ascii": False})
    except Exception as e:
        return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def metrics_developers(request, project_id: int):
    """
    Placeholder for developer scoring.

    IMPORTANT for your rules:
      - Evaluator-only (and Admin) should be able to view/export developer dashboards.
      - Developers should only see THEIR own dashboard.
    For now, this endpoint returns "not wired".

    We'll implement this after you add:
      - DeveloperScore / DeveloperEvaluation models
      - logic to compute scores per developer upload/run
    """
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    return JsonResponse({"message": "developer scoring not wired yet"}, safe=True)
@login_required
@require_GET
def dashboard_stats(request):
    """
    JSON endpoint for React DashboardPage:
    GET /api/reports/dashboard/
    Scoped to projects where the user is a member.
    """

    memberships = (
        ProjectMembership.objects
        .select_related("project")
        .filter(user=request.user)
    )
    project_ids = [m.project_id for m in memberships]
    unique_project_ids = list(set(project_ids))

    total_projects = len(unique_project_ids)

    # total uploads across user's projects
    total_uploads = ProjectFile.objects.filter(project_id__in=unique_project_ids).count()

    # analysis runs status across user's projects
    analyses_done = AnalysisRun.objects.filter(project_id__in=unique_project_ids, status="DONE").count()
    analyses_pending = AnalysisRun.objects.filter(project_id__in=unique_project_ids).exclude(status="DONE").count()

    # recent projects list (max 10)
    recent_projects_qs = (
        Project.objects
        .filter(id__in=unique_project_ids)
        .order_by("-created_at")[:10]
    )

    recent_projects = []
    for p in recent_projects_qs:
        last_run = AnalysisRun.objects.filter(project=p).order_by("-created_at").first()
        status = "done" if (last_run and last_run.status == "DONE") else "pending"
        updated_at = (last_run.created_at if last_run else p.created_at)

        recent_projects.append({
            "id": str(p.id),
            "name": p.name,
            "status": status,
            "updatedAt": updated_at.isoformat() if updated_at else "",
        })

    return JsonResponse(
        {
            "totalProjects": total_projects,
            "totalUploads": total_uploads,
            "analysesPending": analyses_pending,
            "analysesDone": analyses_done,
            "recentProjects": recent_projects,
        },
        safe=True,
        json_dumps_params={"ensure_ascii": False},
    )
