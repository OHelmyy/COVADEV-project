from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from django.conf import settings

from apps.analysis.metrics.evaluation import evaluate_traceability
from apps.analysis.models import AnalysisRun
from apps.analysis.pipelines.postdev_pipeline import PostDevPipeline
from apps.analysis.semantic.analyze import analyze_project

from .storage_service import replace_bpmn_tasks, replace_match_results


def _abs_media_path(stored_path: str) -> Path:
    """
    Convert a stored relative path under MEDIA_ROOT to an absolute Path.
    If stored_path is already absolute, keep it as-is.
    """
    stored_path = str(stored_path or "").strip()
    if not stored_path:
        raise ValueError("Empty stored_path")

    p = Path(stored_path)
    if p.is_absolute():
        return p
    return Path(settings.MEDIA_ROOT) / p


def _resolve_code_root_from_project(project) -> Path:
    """
    CODE upload in projects app should set:
      - project.active_code.extracted_dir = absolute folder path of extracted code
      - project.active_code.stored_path = relative path of zip (audit)

    For backward compatibility, if extracted_dir is empty, fall back to stored_path.
    """
    active_code = getattr(project, "active_code", None)
    if not active_code:
        raise ValueError("No active Code ZIP uploaded for this project.")

    extracted_dir = str(getattr(active_code, "extracted_dir", "") or "").strip()
    if extracted_dir:
        p = Path(extracted_dir)
        return p if p.is_absolute() else (Path(settings.MEDIA_ROOT) / p)

    stored_path = str(getattr(active_code, "stored_path", "") or "").strip()
    if not stored_path:
        raise ValueError("Active code record has no extracted_dir or stored_path.")

    p = Path(stored_path)
    return p if p.is_absolute() else (Path(settings.MEDIA_ROOT) / p)


def run_analysis_for_project(
    project,
    *,
    matcher: str = "greedy",
    top_k: int = 3,
) -> AnalysisRun:
    """
    Backward-compatible wrapper around the PostDevPipeline.
    Keeps the same return type: AnalysisRun.
    """
    pipeline = PostDevPipeline(
        project=project,
        matcher=matcher,
        top_k=top_k,
        abs_media_path_resolver=_abs_media_path,
        code_root_resolver=_resolve_code_root_from_project,
        replace_bpmn_tasks_func=replace_bpmn_tasks,
        replace_match_results_func=replace_match_results,
    )
    return pipeline.run()


def run_semantic_pipeline_for_project(
    project_id: int,
    threshold: float = 0.7,
    top_k: int = 3,
) -> Dict[str, Any]:
    """
    Used by apps/analysis/views.py (dashboard endpoint).
    Returns a UI-ready JSON payload using the same semantic engine.
    """
    from apps.projects.models import Project

    project = Project.objects.select_related("active_bpmn", "active_code").get(id=project_id)

    if not getattr(project, "active_bpmn", None):
        raise ValueError("No active BPMN uploaded for this project.")
    if not getattr(project, "active_code", None):
        raise ValueError("No active Code ZIP uploaded for this project.")

    bpmn_abs = _abs_media_path(project.active_bpmn.stored_path)
    bpmn_bytes = bpmn_abs.read_bytes()

    code_root = _resolve_code_root_from_project(project)

    result = analyze_project(
        bpmn_input=bpmn_bytes,
        code_root=code_root,
        threshold=threshold,
        matcher="greedy",
        top_k=int(top_k),
        include_debug=False,
        project=project,
    )

    return {
        "matching": result.get("matching") or {},
        "stats": result.get("stats") or {},
        "bpmn": result.get("bpmn") or {},
        "code": {
            "items": (result.get("code") or {}).get("items") or [],
        },
        "previews": {
            "bpmn_tasks": ((result.get("bpmn") or {}).get("tasks") or [])[:20],
            "code_items": ((result.get("code") or {}).get("items") or [])[:30],
            "matched": ((result.get("matching") or {}).get("matched") or [])[:30],
            "missing": ((result.get("matching") or {}).get("missing") or [])[:30],
            "extra": ((result.get("matching") or {}).get("extra") or [])[:30],
        },
    }


def compute_metrics_from_similarity_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Consumes POST payload from dashboard and computes evaluation metrics.
    """
    threshold = float(payload.get("threshold", 0.7))
    bpmn_tasks = payload.get("bpmn_tasks", []) or []
    code_items = payload.get("code_items", []) or []
    matches = payload.get("matches", []) or []

    return evaluate_traceability(
        bpmn_tasks=bpmn_tasks,
        code_items=code_items,
        matches=matches,
        threshold=threshold,
    )