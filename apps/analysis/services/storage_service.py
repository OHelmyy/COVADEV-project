from __future__ import annotations

from typing import Any, Dict, List

from apps.analysis.models import BpmnTask, MatchResult
from apps.analysis.summary.bpmn_task_summary import summarize_bpmn_task


def replace_bpmn_tasks(project, tasks: List[Dict[str, Any]]) -> int:
    """
    Replace all BPMN tasks for a project and regenerate task summaries.

    Expected input:
      [
        {"task_id": "...", "name": "...", "description": "..."},
        ...
      ]
    """
    BpmnTask.objects.filter(project=project).delete()

    objs: List[BpmnTask] = []
    for t in tasks:
        task_id = str(t.get("task_id", "")).strip()
        name = str(t.get("name", "")).strip() or "Unnamed Task"
        desc = str(t.get("description", "")).strip()

        if not task_id:
            continue

        summary = summarize_bpmn_task(name=name, description=desc)

        objs.append(
            BpmnTask(
                project=project,
                task_id=task_id,
                name=name,
                description=desc,
                summary_text=summary,
            )
        )

    if objs:
        BpmnTask.objects.bulk_create(objs)

    return BpmnTask.objects.filter(project=project).count()


def replace_match_results(project, results: List[Dict[str, Any]]) -> int:
    """
    Replace all stored match results for a project.

    Expected input:
      [
        {
          "status": "MATCHED|MISSING|EXTRA",
          "task_id": "... optional ...",
          "code_ref": "...",
          "similarity_score": 0.82
        },
        ...
      ]
    """
    MatchResult.objects.filter(project=project).delete()

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