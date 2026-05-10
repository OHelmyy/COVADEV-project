from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.projects.models import Project, ProjectMembership
from apps.projects.ai_agent import get_or_create_ai_user


@receiver(post_save, sender=Project)
def create_ai_membership_for_new_project(sender, instance, created, **kwargs):
    """
    Whenever a new Project is created, automatically attach the
    shared AI agent as a ProjectMembership flagged with is_ai_agent=True.
    """
    if not created:
        return

    ai_user = get_or_create_ai_user()
    ProjectMembership.objects.get_or_create(
        project=instance,
        user=ai_user,
        defaults={
            "role": ProjectMembership.Role.DEVELOPER,
            "is_ai_agent": True,
        },
    )