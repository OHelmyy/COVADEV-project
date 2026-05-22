from __future__ import annotations

from typing import Any, Dict, List

from apps.analysis.models import BpmnTask, MatchResult


def _build_task_summary(
    name: str,
    desc: str,
    task_type: str,
    incoming: list,
    outgoing: list,
) -> str:
    from apps.analysis.summary.bpmn_task_summary import summarize_bpmn_task

    return summarize_bpmn_task(
        name=name,
        description=desc,
        task_type=task_type,
        incoming=incoming,
        outgoing=outgoing,
    )


def _build_task_time_estimate(
    name: str,
    desc: str,
    summary: str,
    task_type: str,
    incoming: list,
    outgoing: list,
) -> dict:
    from apps.analysis.summary.bpmn_time_estimation_service import estimate_bpmn_task_time

    return estimate_bpmn_task_time(
        name=name,
        description=desc,
        summary=summary,
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

        existing = BpmnTask.objects.filter(
            project=project,
            task_id=task_id,
        ).first()

        if existing:
            should_refresh = (
                existing.name != name
                or existing.description != desc
                or existing.task_type != task_type
                or existing.incoming_nodes != incoming_nodes
                or existing.outgoing_nodes != outgoing_nodes
                or not (existing.summary_text or "").strip()
                or not existing.estimated_duration_minutes
            )

            if should_refresh:
                summary = _build_task_summary(
                    name=name,
                    desc=desc,
                    task_type=task_type,
                    incoming=incoming_nodes,
                    outgoing=outgoing_nodes,
                )

                estimate = _build_task_time_estimate(
                    name=name,
                    desc=desc,
                    summary=summary,
                    task_type=task_type,
                    incoming=incoming_nodes,
                    outgoing=outgoing_nodes,
                )

                existing.summary_text = summary
                existing.estimated_duration_minutes = estimate["minutes"]
                existing.estimated_duration_source = estimate["source"]
                existing.estimated_duration_reason = estimate["reason"]

            existing.name = name
            existing.description = desc
            existing.task_type = task_type
            existing.incoming_nodes = incoming_nodes
            existing.outgoing_nodes = outgoing_nodes
            existing.save()

            existing_task_ids.add(task_id)

        else:
            summary = _build_task_summary(
                name=name,
                desc=desc,
                task_type=task_type,
                incoming=incoming_nodes,
                outgoing=outgoing_nodes,
            )

            estimate = _build_task_time_estimate(
                name=name,
                desc=desc,
                summary=summary,
                task_type=task_type,
                incoming=incoming_nodes,
                outgoing=outgoing_nodes,
            )

            BpmnTask.objects.create(
                project=project,
                task_id=task_id,
                name=name,
                description=desc,
                task_type=task_type,
                incoming_nodes=incoming_nodes,
                outgoing_nodes=outgoing_nodes,
                summary_text=summary,
                estimated_duration_minutes=estimate["minutes"],
                estimated_duration_source=estimate["source"],
                estimated_duration_reason=estimate["reason"],
            )

            existing_task_ids.add(task_id)

    BpmnTask.objects.filter(project=project).exclude(
        task_id__in=existing_task_ids,
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

    # Preserve AI-generated matches; only wipe pipeline-generated rows.
    MatchResult.objects.filter(
        project=project,
        is_ai_generated=False,
    ).delete()

    # Tasks that already have an AI-generated match are owned by the AI flow.
    # The pipeline must not create duplicate rows for them.
    ai_owned_task_ids = set(
        MatchResult.objects.filter(
            project=project,
            is_ai_generated=True,
            task__isnull=False,
        ).values_list("task_id", flat=True)
    )

    task_map = {t.task_id: t for t in project.bpmn_tasks.all()}

    objs: List[MatchResult] = []

    for r in results:
        status = str(r.get("status", "MATCHED")).upper().strip()
        task_id = str(r.get("task_id", "")).strip()
        task = task_map.get(task_id) if task_id else None

        # Skip pipeline results for tasks already owned by the AI flow.
        if task is not None and task.id in ai_owned_task_ids:
            continue

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