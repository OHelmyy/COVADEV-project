from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from concurrent.futures import ThreadPoolExecutor

from django.db import transaction
from django.utils import timezone

from apps.analysis.bpmn.parser import extract_tasks_with_context
from apps.analysis.models import AnalysisRun
from apps.analysis.models_code import CodeArtifact
from apps.analysis.semantic.analyze import (
    analyze_bpmn_side,
    analyze_code_side,
    match_bpmn_code,
)
from apps.projects.services import _persist_code_artifacts_with_summaries


class PostDevPipeline:
    """
    Factory-based concrete pipeline for full project analysis.

    Keeps the same high-level behavior as the old run_analysis_for_project():
      - validate active BPMN/code
      - create AnalysisRun and mark RUNNING
      - read BPMN bytes
      - parse/store BPMN tasks
      - regenerate CodeArtifact summaries
      - run semantic engine
      - convert/store match results
      - mark run DONE / FAILED
      - return AnalysisRun
    """

    def __init__(
        self,
        *,
        project,
        matcher: str = "greedy",
        top_k: int = 3,
        abs_media_path_resolver,
        code_root_resolver,
        replace_bpmn_tasks_func,
        replace_match_results_func,
    ) -> None:
        self.project = project
        self.matcher = matcher
        self.top_k = int(top_k)

        # injected helpers from services.py
        self._abs_media_path = abs_media_path_resolver
        self._resolve_code_root_from_project = code_root_resolver
        self._replace_bpmn_tasks = replace_bpmn_tasks_func
        self._replace_match_results = replace_match_results_func

        self.run_obj: Optional[AnalysisRun] = None
        self.bpmn_abs: Optional[Path] = None
        self.bpmn_bytes: bytes = b""
        self.code_root: Optional[Path] = None

        self.storage_tasks: List[Dict[str, Any]] = []

        self.threshold: float = 0.6
        self.engine_result: Dict[str, Any] = {}
        self.storage_results: List[Dict[str, Any]] = []

    def run(self) -> AnalysisRun:
        try:
            self._validate()
            self._load()
            self._preprocess()
            self._execute()
            self._save()
            return self._build_response()
        except Exception as e:
            self._mark_failed(str(e))
            return self._build_response()

    def _validate(self) -> None:
        if not getattr(self.project, "active_bpmn", None):
            raise ValueError("No active BPMN uploaded for this project.")
        if not getattr(self.project, "active_code", None):
            raise ValueError("No active Code ZIP uploaded for this project.")

    def _load(self) -> None:
        with transaction.atomic():
            self.run_obj = AnalysisRun.objects.create(project=self.project, status="PENDING")
            self.run_obj.status = "RUNNING"
            self.run_obj.started_at = timezone.now()
            self.run_obj.save(update_fields=["status", "started_at"])

        self.bpmn_abs = self._abs_media_path(self.project.active_bpmn.stored_path)
        self.bpmn_bytes = self.bpmn_abs.read_bytes()
        self.code_root = self._resolve_code_root_from_project(self.project)

    def _preprocess(self) -> None:
        self.storage_tasks = extract_tasks_with_context(self.bpmn_bytes)

    def _execute(self) -> None:
        CodeArtifact.objects.filter(project=self.project).delete()

        with ThreadPoolExecutor(max_workers=2) as executor:
            future_bpmn = executor.submit(
                self._replace_bpmn_tasks,
                self.project,
                self.storage_tasks,
            )

            future_code = executor.submit(
                _persist_code_artifacts_with_summaries,
                project=self.project,
                code_root_dir=self.code_root,
            )

            future_bpmn.result()
            future_code.result()

        self.threshold = float(getattr(self.project, "similarity_threshold", 0.6) or 0.6)

        bpmn_result = analyze_bpmn_side(
            bpmn_input=self.bpmn_bytes,
            project=self.project,
        )

        code_result = analyze_code_side(
            code_root=self.code_root,
            project=self.project,
        )

        match_result = match_bpmn_code(
            bpmn_tasks=bpmn_result["bpmn_tasks"],
            code_items=code_result["code_items"],
            threshold=self.threshold,
            matcher=self.matcher,
            top_k=self.top_k,
            batch_size=32,
        )

        self.engine_result = {
            "meta": {
                "matcher": match_result["matcher_norm"],
                "threshold": float(self.threshold),
                "top_k": int(self.top_k),
                "batch_size": 32,
                "used_persisted_code_artifacts": bool(code_result["used_persisted"]),
            },
            "bpmn": bpmn_result["bpmn_graph"],
            "code": {"items": code_result["code_items"]},
            "matching": match_result["matching"],
            "top_k": match_result["top_k"],
            "stats": {
                "tasks": len(bpmn_result["bpmn_tasks"]),
                "code_count_embedded": len(code_result["code_items"]),
                "matched": len((match_result["matching"].get("matched") or [])),
                "missing": len((match_result["matching"].get("missing") or [])),
                "extra": len((match_result["matching"].get("extra") or [])),
            },
        }

        matching = self.engine_result.get("matching") or {}
        matched = matching.get("matched") or []
        missing = matching.get("missing") or []
        extra = matching.get("extra") or []

        self.storage_results = []

        for m in matched:
            self.storage_results.append(
                {
                    "status": "MATCHED",
                    "task_id": m.get("task_id", ""),
                    "code_ref": m.get("code_id", ""),
                    "similarity_score": float(m.get("score", 0.0) or 0.0),
                }
            )

        for tid in missing:
            self.storage_results.append(
                {
                    "status": "MISSING",
                    "task_id": tid,
                    "code_ref": "",
                    "similarity_score": 0.0,
                }
            )

        for cid in extra:
            self.storage_results.append(
                {
                    "status": "EXTRA",
                    "task_id": "",
                    "code_ref": cid,
                    "similarity_score": 0.0,
                }
            )

    def _save(self) -> None:
        self._replace_match_results(self.project, self.storage_results)

        if not self.run_obj:
            raise RuntimeError("AnalysisRun was not initialized.")

        self.run_obj.status = "DONE"
        self.run_obj.finished_at = timezone.now()
        self.run_obj.error_message = ""
        self.run_obj.save(update_fields=["status", "finished_at", "error_message"])

    def _build_response(self) -> AnalysisRun:
        if not self.run_obj:
            raise RuntimeError("AnalysisRun was not initialized.")
        return self.run_obj

    def _mark_failed(self, message: str) -> None:
        if not self.run_obj:
            with transaction.atomic():
                self.run_obj = AnalysisRun.objects.create(
                    project=self.project,
                    status="FAILED",
                    started_at=timezone.now(),
                    finished_at=timezone.now(),
                    error_message=message,
                )
            return

        self.run_obj.status = "FAILED"
        self.run_obj.error_message = message
        self.run_obj.finished_at = timezone.now()
        self.run_obj.save(update_fields=["status", "error_message", "finished_at"])