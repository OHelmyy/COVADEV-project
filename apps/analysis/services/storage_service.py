from __future__ import annotations

from typing import Any, Dict, List

from apps.analysis.models import BpmnTask, MatchResult


def _build_task_summary(name: str, desc: str, task_type: str, incoming: list, outgoing: list) -> str:
    from apps.analysis.summary.bpmn_task_summary import summarize_bpmn_task

    return summarize_bpmn_task(
        name=name,
        description=desc,
        task_type=task_type,
        incoming=incoming,
        outgoing=outgoing,
    )

def replace_bpmn_tasks(project, tasks: List[Dict[str, Any]]) -> int:
    existing_task_ids = set()

    for t in tasks:
        task_id = str(t.get("task_id", "")).strip()
        name = str(t.get("name", "")).strip() or "Unnamed Task"
        desc = str(t.get("description", "")).strip()
        task_type = str(t.get("task_type", "")).strip()
        incoming_nodes = t.get("incoming_nodes") or []
        outgoing_nodes = t.get("outgoing_nodes") or []

        if not task_id:
            continue

        existing = BpmnTask.objects.filter(project=project, task_id=task_id).first()

        if existing:
            # only regenerate summary if name or description changed
            if existing.name != name or existing.description != desc:
                summary = _build_task_summary(name, desc, task_type, incoming_nodes, outgoing_nodes)
                existing.name = name
                existing.description = desc
                existing.task_type = task_type
                existing.incoming_nodes = incoming_nodes
                existing.outgoing_nodes = outgoing_nodes
                existing.summary_text = summary
                existing.save()
            existing_task_ids.add(task_id)
        else:
            summary = _build_task_summary(name, desc, task_type, incoming_nodes, outgoing_nodes)
            BpmnTask.objects.create(
                project=project,
                task_id=task_id,
                name=name,
                description=desc,
                task_type=task_type,
                incoming_nodes=incoming_nodes,
                outgoing_nodes=outgoing_nodes,
                summary_text=summary,
            )
            existing_task_ids.add(task_id)

    # Delete tasks that no longer exist in the BPMN
    BpmnTask.objects.filter(project=project).exclude(
        task_id__in=existing_task_ids
    ).delete()

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