from django.core.management.base import BaseCommand

from apps.projects.models import Project, ProjectMembership
from apps.projects.ai_agent import get_or_create_ai_user


class Command(BaseCommand):
    help = "Ensure every existing project has an AI agent ProjectMembership."

    def handle(self, *args, **options):
        ai_user = get_or_create_ai_user()
        created_count = 0
        skipped_count = 0

        for project in Project.objects.all():
            membership, created = ProjectMembership.objects.get_or_create(
                project=project,
                user=ai_user,
                defaults={
                    "role": ProjectMembership.Role.DEVELOPER,
                    "is_ai_agent": True,
                },
            )
            if created:
                created_count += 1
            else:
                # Already exists; make sure the flag is set.
                if not membership.is_ai_agent:
                    membership.is_ai_agent = True
                    membership.save(update_fields=["is_ai_agent"])
                skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"AI memberships created: {created_count}, "
            f"already existed: {skipped_count}"
        ))