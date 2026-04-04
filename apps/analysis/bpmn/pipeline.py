from __future__ import annotations
from typing import Any, Dict

from apps.analysis.pipelines.predev_pipeline import PreDevPipeline


def run_bpmn_predev(bpmn_bytes: bytes, *, do_summary: bool = True) -> Dict[str, Any]:
    return PreDevPipeline(bpmn_bytes=bpmn_bytes, do_summary=do_summary).run()