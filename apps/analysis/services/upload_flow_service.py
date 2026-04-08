from __future__ import annotations

from typing import Any, Dict, List

from apps.analysis.bpmn.pipeline import run_bpmn_predev
from apps.analysis.bpmn.parser import extract_tasks_with_context
from apps.projects.services import save_bpmn_file

from .storage_service import replace_bpmn_tasks


def run_bpmn_upload_flow(project, uploaded_file, user) -> Dict[str, Any]:
    bpmn_bytes = uploaded_file.read()
    uploaded_file.seek(0)

    saved = save_bpmn_file(project, uploaded_file, user)

    bpmn_obj = saved if saved is not None else project.active_bpmn
    if bpmn_obj is None:
        project.refresh_from_db()
        bpmn_obj = project.active_bpmn

    if bpmn_obj is None:
        raise RuntimeError("BPMN file saved, but active BPMN was not set.")

    predev = run_bpmn_predev(bpmn_bytes, do_summary=True)

    storage_tasks = extract_tasks_with_context(bpmn_bytes)

    bpmn_obj.is_well_formed = bool(predev.get("ok", False))
    bpmn_obj.precheck_warnings = predev.get("warnings", []) or []
    bpmn_obj.precheck_errors = predev.get("errors", []) or []
    bpmn_obj.bpmn_summary = predev.get("summary", "") or ""
    bpmn_obj.save(
        update_fields=[
            "is_well_formed",
            "precheck_warnings",
            "precheck_errors",
            "bpmn_summary",
        ]
    )

    return {
        "ok": bool(predev.get("ok", False)),
        "warnings": predev.get("warnings", []) or [],
        "errors": predev.get("errors", []) or [],
        "summary": predev.get("summary", "") or "",
        "taskCount": len(storage_tasks),
        "active_bpmn": bpmn_obj,
    }