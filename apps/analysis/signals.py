from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.analysis.models import BpmnTask


@receiver(post_save, sender=BpmnTask)
def auto_classify_bpmn_task(sender, instance, created, **kwargs):
    """
    When a new BpmnTask is created, classify its AI suitability.
    Runs synchronously, but only on creation, never on updates.
    """
    if not created:
        return

    # Skip if already classified (e.g., classifier was the one that just saved it).
    if instance.ai_suitability and instance.ai_suitability != "UNKNOWN":
        return

    # Imported here to avoid circular imports during Django startup.
    from apps.analysis.services.ai_suitability_service import classify_bpmn_task

    try:
        classify_bpmn_task(instance)
    except Exception as e:
        print(f"[ai_suitability signal] failed for task {instance.id}: {e}")