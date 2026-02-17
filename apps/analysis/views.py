# apps/analysis/views.py

from __future__ import annotations

import json
import traceback
import uuid
import zipfile
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
from apps.projects.models import Project, ProjectMembership, ProjectFile
from apps.analysis.models import AnalysisRun, BpmnTask, MatchResult
from apps.analysis.models_code import CodeArtifact

from .bpmn.parser import extract_tasks
from .code.extractor import extract_python_from_directory
from .embeddings.pipeline import embed_pipeline
from .semantic.similarity import compute_similarity, top_k_matches
from .services import run_semantic_pipeline_for_project, compute_metrics_from_similarity_payload

# Used by compare endpoint
from apps.analysis.services import replace_bpmn_tasks
from apps.analysis.semantic.analyze import analyze_project


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
    """
    Return the extracted code directory for the project's active code zip.
    You must ensure your upload/extract step extracts zip into a stable folder.
    """
    if not getattr(project, "active_code", None):
        raise ValueError("No active Code ZIP uploaded.")

    # stored_path points to the ZIP itself under MEDIA
    zip_abs = _abs_media_path(project.active_code.stored_path)

    # choose a stable extraction folder (example)
    extract_dir = (Path(settings.MEDIA_ROOT) / "projects" / str(project.id) / "code_extracted").resolve()
    _ensure_dir(extract_dir)

    # (Optional) if you already extract elsewhere, just return that folder instead
    # If you want: always re-extract to keep fresh:
    with zipfile.ZipFile(zip_abs, "r") as zf:
        zf.extractall(extract_dir)

    return extract_dir


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
        tasks = extract_tasks(bpmn_path)  # prototype uses path-based parser
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
        result["is_well_formed"] = bool(ab.is_well_formed) if ab else True
    except Exception:
        result["bpmn_summary"] = ""
        result["precheck_warnings"] = []
        result["is_well_formed"] = True

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
def compare_inputs_api(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not _can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if not getattr(project, "active_bpmn", None):
        return JsonResponse({"error": "No active BPMN uploaded."}, status=400)
    if not getattr(project, "active_code", None):
        return JsonResponse({"error": "No active Code ZIP uploaded."}, status=400)

    bpmn_abs = _abs_media_path(project.active_bpmn.stored_path)
    bpmn_bytes = bpmn_abs.read_bytes()

    parsed = extract_tasks(bpmn_bytes)
    storage_tasks = [
        {
            "task_id": (t.get("id") or "").strip(),
            "name": (t.get("name") or "").strip(),
            "description": (t.get("description") or "").strip(),
        }
        for t in (parsed or [])
        if (t.get("id") or "").strip()
    ]
    replace_bpmn_tasks(project, storage_tasks)

    MatchResult.objects.filter(project=project).delete()

    code_root = _resolve_code_root_from_project(project)
    analyze_project(
        bpmn_input=bpmn_bytes,
        code_root=code_root,
        threshold=float(getattr(project, "similarity_threshold", 0.6) or 0.6),
        matcher="greedy",
        top_k=3,
        include_debug=False,
        project=project,
        run=None,
    )

    tasks_qs = BpmnTask.objects.filter(project=project).order_by("name")
    bpmn_tasks = []
    for t in tasks_qs:
        parts = []
        if t.name:
            parts.append(f"Task: {t.name}.")
        if t.description:
            parts.append(f"Description: {t.description}.")
        bpmn_tasks.append(
            {
                "taskId": t.task_id,
                "name": t.name,
                "description": t.description,
                "compareText": " ".join(parts).strip(),
            }
        )

    artifacts_qs = (
        CodeArtifact.objects.filter(project=project)
        .exclude(file_path__startswith="bpmn\\")
        .exclude(file_path__startswith="bpmn/")
        .order_by("file_path", "symbol")
    )

    code_functions = []
    for a in artifacts_qs:
        symbol = (a.symbol or "").strip() or "Unnamed Function"
        summary = (a.summary_text or "").strip()

        title = symbol.replace("_", " ").strip()
        title = title[:1].upper() + title[1:] if title else "Unnamed Function"

        parts = [f"Task: {title}."]
        if summary:
            parts.append(f"Description: {summary}.")
        compare_text = " ".join(parts).strip()

        dev = request.user
        dev_id = getattr(dev, "id", None)
        dev_email = getattr(dev, "email", "") or ""
        dev_name = (
            getattr(dev, "get_username", lambda: "")()
            or getattr(dev, "username", "")
            or getattr(dev, "first_name", "")
            or ""
        )

        code_functions.append(
            {
                "codeUid": a.code_uid,
                "file": a.file_path,
                "symbol": symbol,

                "name": title,
                "functionName": symbol,

                "summary": summary,
                "summary_text": summary,
                "summaryText": summary,

                "developerId": dev_id,
                "developerEmail": dev_email,
                "developerName": dev_name,
                "developer": {"id": dev_id, "email": dev_email, "name": dev_name},

                "compareText": compare_text,
            }
        )

    return JsonResponse(
        {"projectId": project.id, "bpmnTasks": bpmn_tasks, "codeFunctions": code_functions},
        safe=True,
        json_dumps_params={"ensure_ascii": False},
    )

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

