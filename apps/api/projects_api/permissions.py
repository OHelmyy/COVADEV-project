from __future__ import annotations

from django.contrib.auth.models import User

from apps.accounts.rbac import is_admin, is_evaluator
from apps.projects.models import Project, ProjectMembership


def get_membership(project: Project, user) -> ProjectMembership | None:
    return ProjectMembership.objects.filter(project=project, user=user).first()


def is_project_evaluator(project: Project, user: User) -> bool:
    if is_admin(user):
        return True

    if getattr(project, "evaluator_id", None) == user.id:
        return True

    membership = get_membership(project, user)
    return bool(membership and str(getattr(membership, "role", "")).upper() == "EVALUATOR")


def is_project_developer(project: Project, user: User) -> bool:
    if is_admin(user):
        return True
    return ProjectMembership.objects.filter(project=project, user=user).exists()


def can_open_project(project: Project, user: User) -> bool:
    return is_project_evaluator(project, user) or is_project_developer(project, user)


def require_member(project: Project, user) -> bool:
    if is_admin(user):
        return True
    return get_membership(project, user) is not None


def require_admin_or_evaluator(project: Project, user) -> bool:
    return is_project_evaluator(project, user)