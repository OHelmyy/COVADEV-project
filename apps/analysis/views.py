# apps/analysis/views.py

from __future__ import annotations

import json
import traceback
from pathlib import Path
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods
from apps.projects.models import Project, ProjectMembership, ProjectFile
from apps.analysis.models import AnalysisRun
from apps.accounts.rbac import is_admin, is_evaluator
from .services.services import run_semantic_pipeline_for_project, compute_metrics_from_similarity_payload

# ============================================================
# Helpers
# ============================================================

def _abs_media_path(stored_path: str) -> Path:
    """
    Convert a MEDIA relative stored path to an absolute Path.
    """
    return (Path(settings.MEDIA_ROOT) / stored_path).resolve()


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


def _forbidden():
    return JsonResponse({"detail": "Forbidden"}, status=403)


def _resolve_code_root_from_project(project: Project) -> Path:
    active_code = getattr(project, "active_code", None)
    if not active_code:
        raise ValueError("No active Code ZIP uploaded.")

    extracted_dir = str(getattr(active_code, "extracted_dir", "") or "").strip()
    if extracted_dir:
        p = Path(extracted_dir)
        return p if p.is_absolute() else (Path(settings.MEDIA_ROOT) / p)

    raise ValueError("No extracted_dir found. Re-upload the code ZIP.")

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
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    threshold = float(request.GET.get("threshold", project.similarity_threshold or 0.7))
    top_k = int(request.GET.get("top_k", 3))

    result = run_semantic_pipeline_for_project(project_id, threshold=threshold, top_k=top_k)

    # Attach pre-dev info stored on active_bpmn
    try:
        project = Project.objects.select_related("active_bpmn").get(id=project_id)
        ab = project.active_bpmn
        result["bpmn_summary"] = (ab.bpmn_summary if ab else "") or ""
        result["precheck_warnings"] = (ab.precheck_warnings if ab else []) or []
        result["precheck_errors"] = (ab.precheck_errors if ab else []) or []
        result["is_well_formed"] = bool(ab.is_well_formed) if ab else False
    except Exception:
        result["bpmn_summary"] = ""
        result["precheck_warnings"] = []
        result["precheck_errors"] = []
        result["is_well_formed"] = False

    return JsonResponse(result, safe=True, json_dumps_params={"ensure_ascii": False})


# ============================================================
# ✅ Metrics endpoints
# ============================================================

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def run_project_metrics(request, project_id: int):
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
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    return JsonResponse({"message": "developer scoring not wired yet"}, safe=True)


# ============================================================
# Compare BPMN vs Code inputs endpoint
# ============================================================
@login_required
@require_GET
def dashboard_stats(request):
    """
    JSON endpoint for React DashboardPage:
    GET /analysis/api/reports/dashboard/
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
    total_uploads = ProjectFile.objects.filter(project_id__in=unique_project_ids).count()

    analyses_done = AnalysisRun.objects.filter(project_id__in=unique_project_ids, status="DONE").count()
    analyses_pending = AnalysisRun.objects.filter(project_id__in=unique_project_ids).exclude(status="DONE").count()

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

