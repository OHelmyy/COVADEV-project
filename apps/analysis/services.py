from django.db import transaction
from django.utils import timezone
from .models import AnalysisRun


def run_analysis_for_version(version):
    """
    MVP backbone:
    - create AnalysisRun
    - set RUNNING
    - mark DONE (mock)
    Later: Serag/Mostafa plug real pipeline here.
    """
    with transaction.atomic():
        run = AnalysisRun.objects.create(
            version=version,
            status="PENDING",
        )
        run.status = "RUNNING"
        run.started_at = timezone.now()
        run.save(update_fields=["status", "started_at"])

    try:
        #serag w mostafa
        # TODO: real pipeline goes here:
        # - parse BPMN tasks
        # - extract code elements
        # - match
        # - compute metrics
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


from .models import BpmnTask


def replace_bpmn_tasks(version, tasks):
    """
    Storage helper for Dev 2 (Serag).
    tasks: list of dicts:
      [{"task_id": "...", "name": "...", "description": "..."}]
    """
    BpmnTask.objects.filter(version=version).delete()

    objs = []
    for t in tasks:
        objs.append(
            BpmnTask(
                version=version,
                task_id=str(t.get("task_id", "")).strip(),
                name=str(t.get("name", "")).strip() or "Unnamed Task",
                description=str(t.get("description", "")).strip(),
            )
        )

    if objs:
        BpmnTask.objects.bulk_create(objs)

    return BpmnTask.objects.filter(version=version).count()


from .models import MatchResult

def replace_match_results(version, results):
    """
    Storage helper for Dev 2 (Serag) / Dev 3 (Mostafa).
    results: list of dicts:
      {
        "status": "MATCHED|MISSING|EXTRA",
        "task_id": "... optional ...",
        "code_ref": "...",
        "similarity_score": 0.82
      }
    """
    MatchResult.objects.filter(version=version).delete()

    # build task lookup
    task_map = {t.task_id: t for t in version.bpmn_tasks.all()}

    objs = []
    for r in results:
        status = str(r.get("status", "MATCHED")).upper().strip()
        task_id = str(r.get("task_id", "")).strip()
        task = task_map.get(task_id) if task_id else None

        objs.append(
            MatchResult(
                version=version,
                task=task,
                code_ref=str(r.get("code_ref", "")).strip(),
                similarity_score=float(r.get("similarity_score", 0.0) or 0.0),
                status=status,
            )
        )

    if objs:
        MatchResult.objects.bulk_create(objs)

    return MatchResult.objects.filter(version=version).count()
