# apps/analysis/services.py

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.analysis.bpmn.parser import extract_tasks
from apps.analysis.semantic.analyze import analyze_project

from .models import AnalysisRun, BpmnTask, MatchResult


def _abs_media_path(stored_path: str) -> Path:
    """
    Convert a stored relative path under MEDIA_ROOT to an absolute Path.
    If stored_path is already absolute, keep it as-is.
    """
    p = Path(str(stored_path or "").strip())
    if not p:
        raise ValueError("Empty stored_path")
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
            # Skip invalid rows (no BPMN id)
            continue

        objs.append(
            BpmnTask(
                project=project,
                task_id=task_id,
                name=name,
                description=desc,
            )
        )

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

    Inputs expected on the Project:
      - project.active_bpmn.stored_path : relative BPMN file path under MEDIA_ROOT
      - project.active_code.extracted_dir : folder path for extracted code
      - project.similarity_threshold : float

    What this does:
      1) Create AnalysisRun (RUNNING)
      2) Read BPMN bytes and parse tasks
      3) Store tasks in BpmnTask
      4) Call semantic engine analyze_project(...)
      5) Store MatchResult rows (MATCHED/MISSING/EXTRA)
      6) Mark run DONE/FAILED
    """
    # Basic validation
    if not getattr(project, "active_bpmn", None):
        raise ValueError("No active BPMN uploaded for this project.")
    if not getattr(project, "active_code", None):
        raise ValueError("No active Code ZIP uploaded for this project.")

    # Create and mark RUNNING atomically
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
        )

        # ---- 5) Convert engine output -> MatchResult storage schema ----
        matching = result.get("matching") or {}
        matched = matching.get("matched") or []
        missing = matching.get("missing") or []
        extra = matching.get("extra") or []

        storage_results: List[Dict[str, Any]] = []

        # matched pairs: {task_id, code_id, score}
        for m in matched:
            storage_results.append(
                {
                    "status": "MATCHED",
                    "task_id": m.get("task_id", ""),
                    "code_ref": m.get("code_id", ""),
                    "similarity_score": float(m.get("score", 0.0) or 0.0),
                }
            )

        # missing tasks: list[str] of task ids
        for tid in missing:
            storage_results.append(
                {
                    "status": "MISSING",
                    "task_id": tid,
                    "code_ref": "",
                    "similarity_score": 0.0,
                }
            )

        # extra code: list[str] of code ids
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
