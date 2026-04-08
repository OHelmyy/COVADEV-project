from __future__ import annotations
from typing import Any, Dict

from apps.analysis.pipelines.pipeline_factory import PipelineFactory

def run_bpmn_predev(bpmn_bytes: bytes, *, do_summary: bool = True) -> Dict[str, Any]:

    pipeline = PipelineFactory.create_predev(
        bpmn_bytes=bpmn_bytes,
        do_summary=do_summary,
    )
    return pipeline.run()