from __future__ import annotations

from typing import Any, Dict, List, Optional

from apps.analysis.bpmn.precheck import PrecheckResult, precheck_bpmn_xml
from apps.analysis.bpmn.parser import extract_tasks, extract_bpmn_graph
from apps.analysis.bpmn.summarizer import (
    build_bpmn_summary_input,
    summarize_bpmn_text,
)

from .base_pipeline import BasePipeline


class PreDevPipeline(BasePipeline):
    """
    Concrete Template Method pipeline for BPMN pre-development analysis.

    Current behavior matches the old run_bpmn_predev() flow:
      - precheck BPMN
      - extract tasks
      - resolve process name
      - optionally build summary input
      - optionally generate summary
      - return stable response payload
    """

    def __init__(self, bpmn_bytes: bytes, *, do_summary: bool = True) -> None:
        super().__init__()
        self.bpmn_bytes = bpmn_bytes
        self.do_summary = do_summary

        self.check: Optional[PrecheckResult] = None
        self.tasks: List[Dict[str, Any]] = []
        self.process_name: str = ""
        self.task_names: List[str] = []
        self.summary_input: str = ""
        self.summary: str = ""

    def validate(self) -> None:
        self.check = precheck_bpmn_xml(self.bpmn_bytes)

    def should_stop(self) -> bool:
        return not bool(self.check and self.check.ok)

    def load(self) -> None:
        self.tasks = extract_tasks(self.bpmn_bytes)

        self.process_name = self.check.process_name if self.check else ""

        try:
            graph = extract_bpmn_graph(self.bpmn_bytes)
            self.process_name = (graph.get("process") or {}).get("name") or self.process_name
        except Exception:
            # Keep old behavior: ignore graph extraction failure here
            pass

    def preprocess(self) -> None:
        if not self.do_summary:
            return

        self.task_names = []
        for task in self.tasks:
            name = str(task.get("name", "") or "").strip()
            if name:
                self.task_names.append(name)

        self.summary_input = build_bpmn_summary_input(self.process_name, self.task_names)

    def execute(self) -> None:
        if self.do_summary and self.summary_input:
            self.summary = summarize_bpmn_text(self.summary_input)
        else:
            self.summary = ""

    def save(self) -> None:
        # Pre-dev v1: no DB persistence here yet.
        # Persistence can be added later without changing the run() template.
        return None

    def build_response(self) -> Dict[str, Any]:
        if not self.check or not self.check.ok:
            return {
                "ok": False,
                "errors": self.check.errors if self.check else ["Unknown BPMN validation error."],
                "warnings": self.check.warnings if self.check else [],
                "tasks": [],
                "summary": "",
                "meta": {},
            }

        return {
            "ok": True,
            "errors": [],
            "warnings": self.check.warnings,
            "tasks": self.tasks,
            "summary": self.summary,
            "meta": {
                "process_name": self.process_name,
                "task_count": self.check.task_count,
            },
        }