from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from django.db import transaction
from django.utils import timezone

from apps.analysis.bpmn.parser import extract_tasks_with_context
from apps.analysis.models import AnalysisRun
from apps.analysis.models_code import CodeArtifact
from apps.analysis.semantic.analyze import analyze_project
from apps.projects.services import _persist_code_artifacts_with_summaries
from apps.analysis.models import CodeEmbedding, TaskEmbedding
from .base_pipeline import BasePipeline


class PostDevPipeline(BasePipeline):
    """
    Concrete Template Method pipeline for full project analysis.

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
        super().__init__()
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
        self.bpmn_graph: Dict[str, Any] = {}
        self.threshold: float = 0.6
        self.engine_result: Dict[str, Any] = {}
        self.storage_results: List[Dict[str, Any]] = []

        self._failed_early: bool = False
        self._failure_message: str = ""

    def run(self) -> AnalysisRun:
        """
        Override the base run() because this pipeline must:
          - return AnalysisRun (not dict)
          - handle failure by marking the run FAILED
        """
        try:
            self.validate()
            self.load()
            self.preprocess()
            self.execute()
            self.save()
            return self.build_response()
        except Exception as e:
            self._mark_failed(str(e))
            return self.build_response()

    def validate(self) -> None:
        if not getattr(self.project, "active_bpmn", None):
            raise ValueError("No active BPMN uploaded for this project.")
        if not getattr(self.project, "active_code", None):
            raise ValueError("No active Code ZIP uploaded for this project.")

    def load(self) -> None:
        with transaction.atomic():
            self.run_obj = AnalysisRun.objects.create(project=self.project, status="PENDING")
            self.run_obj.status = "RUNNING"
            self.run_obj.started_at = timezone.now()
            self.run_obj.save(update_fields=["status", "started_at"])

        self.bpmn_abs = self._abs_media_path(self.project.active_bpmn.stored_path)
        self.bpmn_bytes = self.bpmn_abs.read_bytes()
        self.code_root = self._resolve_code_root_from_project(self.project)

    def preprocess(self) -> None:
        self.storage_tasks = extract_tasks_with_context(self.bpmn_bytes)
        from apps.analysis.bpmn.parser import extract_bpmn_graph
        self.bpmn_graph = extract_bpmn_graph(self.bpmn_bytes)

    def execute(self) -> None:
        # 1) Store BPMN tasks
        self._replace_bpmn_tasks(self.project, self.storage_tasks)

        # 2) Only regenerate code summaries if code was re-uploaded since last run
        last_run = (
            AnalysisRun.objects
            .filter(project=self.project, status="DONE")
            .exclude(id=self.run_obj.id)
            .order_by("-finished_at")
            .first()
        )
        active_code_uploaded_at = getattr(self.project.active_code, "created_at", None)
        last_run_finished_at = getattr(last_run, "finished_at", None)

        code_changed = (
            last_run_finished_at is None
            or active_code_uploaded_at is None
            or active_code_uploaded_at > last_run_finished_at
        )

        if code_changed:
            CodeArtifact.objects.filter(project=self.project).delete()
            _persist_code_artifacts_with_summaries(
                project=self.project,
                code_root_dir=self.code_root,
            )

        # 3) Semantic engine
        self.threshold = float(getattr(self.project, "similarity_threshold", 0.6) or 0.6)

        self.engine_result = analyze_project(
            bpmn_input=self.bpmn_bytes,
            code_root=self.code_root,
            threshold=self.threshold,
            matcher=self.matcher,
            top_k=self.top_k,
            include_debug=False,
            project=self.project,
            bpmn_graph_override=self.bpmn_graph,
        )

        # Save embeddings to DB for future runs
        embedded = self.engine_result.get("_embedded")
        if embedded:
            self._save_embeddings(embedded)


        # 4) Convert matching result into storage schema
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

    def _save_embeddings(self, embedded: dict) -> None:
        task_embeddings = embedded.get("task_embeddings") or []
        code_embeddings = embedded.get("code_embeddings") or []

        task_map = {
            t.task_id: t
            for t in self.project.bpmn_tasks.all()
        }

        code_map = {
            a.code_uid: a
            for a in self.project.code_artifacts.all()
        }

        with transaction.atomic():
            for emb in task_embeddings:
                task = task_map.get(str(emb.get("id")))
                if task:
                    TaskEmbedding.objects.update_or_create(
                        project=self.project,
                        bpmn_task=task,
                        defaults={"vector": emb.get("vector")},
                    )

            for emb in code_embeddings:
                artifact = code_map.get(str(emb.get("id")))
                if artifact:
                    CodeEmbedding.objects.update_or_create(
                        project=self.project,
                        code_artifact=artifact,
                        defaults={"vector": emb.get("vector")},
                    )
    def save(self) -> None:
        self._replace_match_results(self.project, self.storage_results)

        if not self.run_obj:
            raise RuntimeError("AnalysisRun was not initialized.")

        self.run_obj.status = "DONE"
        self.run_obj.finished_at = timezone.now()
        self.run_obj.error_message = ""
        self.run_obj.save(update_fields=["status", "finished_at", "error_message"])

    def build_response(self) -> AnalysisRun:
        if not self.run_obj:
            raise RuntimeError("AnalysisRun was not initialized.")
        return self.run_obj

    def _mark_failed(self, message: str) -> None:
        if not self.run_obj:
            # validation failed before AnalysisRun creation
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