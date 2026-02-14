from __future__ import annotations
from typing import Any, Dict, List

from .precheck import precheck_bpmn_xml
from .parser import extract_tasks, extract_bpmn_graph
from .summarizer import build_bpmn_summary_input, summarize_bpmn_text

def run_bpmn_predev(bpmn_bytes: bytes, *, do_summary: bool = True) -> Dict[str, Any]:
    check = precheck_bpmn_xml(bpmn_bytes)
    if not check.ok:
        return {
            "ok": False,
            "errors": check.errors,
            "warnings": check.warnings,
            "tasks": [],
            "summary": "",
            "meta": {},
        }

    tasks = extract_tasks(bpmn_bytes)

    process_name = check.process_name
    try:
        g = extract_bpmn_graph(bpmn_bytes)
        process_name = (g.get("process") or {}).get("name") or process_name
    except Exception:
        pass

    summary = ""
    if do_summary:
        task_names: List[str] = []
        for t in tasks:
            name = str(t.get("name", "") or "").strip()
            if name:
                task_names.append(name)

        inp = build_bpmn_summary_input(process_name, task_names)
        summary = summarize_bpmn_text(inp)

    return {
        "ok": True,
        "errors": [],
        "warnings": check.warnings,
        "tasks": tasks,
        "summary": summary,
        "meta": {"process_name": process_name, "task_count": check.task_count},
    }