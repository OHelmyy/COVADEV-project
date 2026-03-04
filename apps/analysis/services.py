# apps/analysis/services.py
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.analysis.bpmn.parser import extract_tasks
from apps.analysis.semantic.analyze import analyze_project

from .models import AnalysisRun, BpmnTask, MatchResult
from .metrics.evaluation import evaluate_traceability


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
      - project.active_code.stored_path  = relative path of zip (audit)

    For backward compatibility, if extracted_dir is empty, we fall back to stored_path.
    """
    active_code = getattr(project, "active_code", None)
    if not active_code:
        raise ValueError("No active Code ZIP uploaded for this project.")

    extracted_dir = str(getattr(active_code, "extracted_dir", "") or "").strip()
    if extracted_dir:
        p = Path(extracted_dir)
        return p if p.is_absolute() else (Path(settings.MEDIA_ROOT) / p)

    # Backward compatibility (old behavior might store folder in stored_path)
    stored_path = str(getattr(active_code, "stored_path", "") or "").strip()
    if not stored_path:
        raise ValueError("Active code record has no extracted_dir or stored_path.")
    p = Path(stored_path)
    return p if p.is_absolute() else (Path(settings.MEDIA_ROOT) / p)


def replace_bpmn_tasks(project, tasks: List[Dict[str, Any]]) -> int:
    """
    Storage helper (Project-based) for BPMN tasks.
    tasks: list of dicts:
      [{"task_id": "...", "name": "...", "description": "..."}]
    """
    BpmnTask.objects.filter(project=project).delete()

    objs: List[BpmnTask] = []
    for t in tasks:
        task_id = str(t.get("task_id", "")).strip()
        name = str(t.get("name", "")).strip() or "Unnamed Task"
        desc = str(t.get("description", "")).strip()

        if not task_id:
            continue

        objs.append(BpmnTask(project=project, task_id=task_id, name=name, description=desc))

    if objs:
        BpmnTask.objects.bulk_create(objs)

    return BpmnTask.objects.filter(project=project).count()


def replace_match_results(project, results: List[Dict[str, Any]]) -> int:
    """
    Storage helper (Project-based) for match results.
    results: list of dicts:
      {
        "status": "MATCHED|MISSING|EXTRA",
        "task_id": "... optional ...",
        "code_ref": "...",
        "similarity_score": 0.82
      }
    """
    MatchResult.objects.filter(project=project).delete()

    # build task lookup (project-based)
    task_map = {t.task_id: t for t in project.bpmn_tasks.all()}

    objs: List[MatchResult] = []
    for r in results:
        status = str(r.get("status", "MATCHED")).upper().strip()
        task_id = str(r.get("task_id", "")).strip()
        task = task_map.get(task_id) if task_id else None

        objs.append(
            MatchResult(
                project=project,
                task=task,
                code_ref=str(r.get("code_ref", "")).strip(),
                similarity_score=float(r.get("similarity_score", 0.0) or 0.0),
                status=status,
            )
        )

    if objs:
        MatchResult.objects.bulk_create(objs)

    return MatchResult.objects.filter(project=project).count()


def run_analysis_for_project(
    project,
    *,
    matcher: str = "greedy",
    top_k: int = 3,
) -> AnalysisRun:
    """
    Real pipeline (Project-based, no versions):
      1) Create AnalysisRun (RUNNING)
      2) Read BPMN bytes and parse tasks
      3) Store tasks in BpmnTask
      4) Call semantic engine analyze_project(...)  ✅ (uses code summaries)
      5) Store MatchResult rows (MATCHED/MISSING/EXTRA)
      6) Mark run DONE/FAILED
    """
    if not getattr(project, "active_bpmn", None):
        raise ValueError("No active BPMN uploaded for this project.")
    if not getattr(project, "active_code", None):
        raise ValueError("No active Code ZIP uploaded for this project.")

    with transaction.atomic():
        run = AnalysisRun.objects.create(project=project, status="PENDING")
        run.status = "RUNNING"
        run.started_at = timezone.now()
        run.save(update_fields=["status", "started_at"])

    try:
        # ---- 1) Read BPMN bytes ----
        bpmn_abs = _abs_media_path(project.active_bpmn.stored_path)
        bpmn_bytes = bpmn_abs.read_bytes()

        # ---- 2) Parse BPMN tasks and store ----
        parsed = extract_tasks(bpmn_bytes)  # [{id,name,description,type}, ...]
        storage_tasks: List[Dict[str, Any]] = [
            {
                "task_id": t.get("id", ""),
                "name": t.get("name", ""),
                "description": t.get("description", ""),
            }
            for t in parsed
        ]
        replace_bpmn_tasks(project, storage_tasks)

        # ---- 3) Resolve code root ----
        code_root = _resolve_code_root_from_project(project)

        # ---- 4) Run semantic engine ----
        threshold = float(getattr(project, "similarity_threshold", 0.6) or 0.6)

        result = analyze_project(
            bpmn_input=bpmn_bytes,
            code_root=code_root,
            threshold=threshold,
            matcher=matcher,
            top_k=int(top_k),
            include_debug=False,
            project=project,  # ✅ IMPORTANT: store CodeArtifact (summaries)
            run=run,          # ✅ IMPORTANT: store embeddings/similarity (optional models)
        )

        # ---- 5) Convert engine output -> MatchResult storage schema ----
        matching = result.get("matching") or {}
        matched = matching.get("matched") or []
        missing = matching.get("missing") or []
        extra = matching.get("extra") or []

        storage_results: List[Dict[str, Any]] = []

        for m in matched:
            storage_results.append(
                {
                    "status": "MATCHED",
                    "task_id": m.get("task_id", ""),
                    "code_ref": m.get("code_id", ""),
                    "similarity_score": float(m.get("score", 0.0) or 0.0),
                }
            )

        for tid in missing:
            storage_results.append(
                {
                    "status": "MISSING",
                    "task_id": tid,
                    "code_ref": "",
                    "similarity_score": 0.0,
                }
            )

        for cid in extra:
            storage_results.append(
                {
                    "status": "EXTRA",
                    "task_id": "",
                    "code_ref": cid,
                    "similarity_score": 0.0,
                }
            )

        replace_match_results(project, storage_results)

        # ---- 6) Mark DONE ----
        run.status = "DONE"
        run.finished_at = timezone.now()
        run.error_message = ""
        run.save(update_fields=["status", "finished_at", "error_message"])
        return run

    except Exception as e:
        run.status = "FAILED"
        run.error_message = str(e)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "error_message", "finished_at"])
        return run


def run_semantic_pipeline_for_project(project_id: int, threshold: float = 0.7, top_k: int = 3) -> Dict[str, Any]:
    """
    Used by apps/analysis/views.py (dashboard endpoint).
    It should return a UI-ready JSON payload.

    IMPORTANT:
    - This uses the SAME engine (analyze_project) so you are comparing:
      BPMN tasks ↔ code summaries
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

    # We do NOT create an AnalysisRun here (this endpoint is for dashboard preview).
    # The official "Run Analysis" button should call run_analysis_for_project().
    result = analyze_project(
    bpmn_input=bpmn_bytes,
    code_root=code_root,
    threshold=threshold,
    matcher="greedy",
    top_k=int(top_k),
    include_debug=False,
    project=project,
    run=None,
)



    # Build UI-friendly previews
    return {
        "summary": result.get("summary_status") or {},
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
