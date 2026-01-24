# apps/analysis/services.py

from django.db import transaction
from django.utils import timezone

from .models import AnalysisRun, BpmnTask, MatchResult


def run_analysis_for_project(project):
    """
    MVP backbone (Project-based):
    - create AnalysisRun
    - set RUNNING
    - mark DONE (mock)
    Later: Serag/Mostafa plug real pipeline here.

    Expected inputs (after removing versioning):
    - project.active_bpmn : ProjectFile (BPMN) or None
    - project.active_code : ProjectFile (CODE) or None
    - project.code_files  : indexed CodeFile rows (project-based)
    """
    # Basic validation (optional but very useful)
    if not getattr(project, "active_bpmn", None):
        raise ValueError("No active BPMN uploaded for this project.")
    if not getattr(project, "active_code", None):
        raise ValueError("No active Code ZIP uploaded for this project.")

    with transaction.atomic():
        run = AnalysisRun.objects.create(
            project=project,
            status="PENDING",
        )
        run.status = "RUNNING"
        run.started_at = timezone.now()
        run.save(update_fields=["status", "started_at"])

    try:
        # Serag w Mostafa
        # TODO: real pipeline goes here:
        # - parse BPMN tasks from project.active_bpmn
        # - extract code elements from project.code_files or stored folder
        # - match
        # - compute metrics
        #
        # In MVP mock: just mark done
        run.status = "DONE"
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "finished_at"])
        return run

    except Exception as e:
        run.status = "FAILED"
        run.error_message = str(e)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "error_message", "finished_at"])
        return run


def replace_bpmn_tasks(project, tasks):
    """
    Storage helper (Project-based) for Dev 2 (Serag).
    tasks: list of dicts:
      [{"task_id": "...", "name": "...", "description": "..."}]
    """
    BpmnTask.objects.filter(project=project).delete()

    objs = []
    for t in tasks:
        objs.append(
            BpmnTask(
                project=project,
                task_id=str(t.get("task_id", "")).strip(),
                name=str(t.get("name", "")).strip() or "Unnamed Task",
                description=str(t.get("description", "")).strip(),
            )
        )

    if objs:
        BpmnTask.objects.bulk_create(objs)

    return BpmnTask.objects.filter(project=project).count()


def replace_match_results(project, results):
    """
    Storage helper (Project-based) for Dev 2 (Serag) / Dev 3 (Mostafa).
    results: list of dicts:
      {
        "status": "MATCHED|MISSING|EXTRA",
        "task_id": "... optional ...",
        "code_ref": "...",
        "similarity_score": 0.82
      }
    """
    MatchResult.objects.filter(project=project).delete()

    # build task lookup (project-based)
    task_map = {t.task_id: t for t in project.bpmn_tasks.all()}

    objs = []
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
