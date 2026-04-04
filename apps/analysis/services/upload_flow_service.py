from __future__ import annotations

from typing import Any, Dict, List

from apps.analysis.bpmn.pipeline import run_bpmn_predev
from apps.projects.services import save_bpmn_file

from .storage_service import replace_bpmn_tasks


def run_bpmn_upload_flow(project, uploaded_file, user) -> Dict[str, Any]:
    """
    Application flow for BPMN upload.

    Orchestrates:
      1) read BPMN bytes
      2) save BPMN file
      3) run pre-dev pipeline
      4) replace project BPMN tasks
      5) persist precheck + summary on active BPMN file
      6) ensure project.active_bpmn is set
    """
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

    extracted_tasks = predev.get("tasks", []) or []

    storage_tasks: List[Dict[str, Any]] = []
    for t in extracted_tasks:
        task_id = str(t.get("id", "") or "").strip()
        if not task_id:
            continue

        storage_tasks.append(
            {
                "task_id": task_id,
                "name": str(t.get("name", "") or "").strip(),
                "description": str(t.get("description", "") or "").strip(),
            }
        )

    replace_bpmn_tasks(project, storage_tasks)

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

    if getattr(project, "active_bpmn_id", None) != bpmn_obj.id:
        project.active_bpmn = bpmn_obj
        project.save(update_fields=["active_bpmn"])

    return {
        "ok": True,
        "active_bpmn": bpmn_obj,
        "predev": predev,
    }