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
