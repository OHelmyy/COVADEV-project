from django.core.management.base import BaseCommand

from apps.analysis.models import BpmnTask
from apps.analysis.services.ai_suitability_service import classify_bpmn_task


class Command(BaseCommand):
    help = "Classify all BpmnTasks that are still UNKNOWN for AI suitability."

    def add_arguments(self, parser):
        parser.add_argument(
            "--project",
            type=int,
            default=None,
            help="Optional project id to limit classification to one project.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-classify even tasks that already have a label.",
        )

    def handle(self, *args, **options):
        qs = BpmnTask.objects.all()
        if options["project"]:
            qs = qs.filter(project_id=options["project"])
        if not options["force"]:
            qs = qs.filter(ai_suitability="UNKNOWN")

        total = qs.count()
        self.stdout.write(f"Classifying {total} task(s)...")

        done = 0
        for task in qs.iterator():
            classify_bpmn_task(task)
            done += 1
            if done % 5 == 0:
                self.stdout.write(f"  {done}/{total} done")

        self.stdout.write(self.style.SUCCESS(f"Classified {done} task(s)."))