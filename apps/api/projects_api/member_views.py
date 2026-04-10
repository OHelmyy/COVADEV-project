from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods, require_POST

from apps.projects.models import Project, ProjectMembership
from apps.accounts.rbac import is_admin

from .permissions import is_project_evaluator


def can_view_project_members(project: Project, user) -> bool:
    if is_admin(user):
        return True

    if is_project_evaluator(project, user):
        return True

    return ProjectMembership.objects.filter(project=project, user=user).exists()


@login_required
@require_http_methods(["GET", "POST"])
def api_project_members(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if request.method == "GET":
        if not can_view_project_members(project, request.user):
            return JsonResponse({"detail": "Forbidden"}, status=403)

        members = (
            ProjectMembership.objects
            .select_related("user")
            .filter(project=project)
            .order_by("user__username")
        )
        return JsonResponse({
            "projectId": project.id,
            "members": [
                {
                    "id": m.id,
                    "username": m.user.username,
                    "email": m.user.email,
                    "role": getattr(m, "role", "DEVELOPER"),
                }
                for m in members
            ],
            "evaluator": {
                "id": project.evaluator_id,
                "username": project.evaluator.username if project.evaluator_id else None,
                "email": project.evaluator.email if project.evaluator_id else None,
            } if project.evaluator_id else None,
        })

    # POST = add member -> admin only
    if not is_admin(request.user):
        return JsonResponse({"detail": "Only admin can manage members."}, status=403)

    email = (request.POST.get("email") or "").strip().lower()
    if not email:
        return JsonResponse({"detail": "Enter an email."}, status=400)

    user = User.objects.filter(username=email).first() or User.objects.filter(email=email).first()
    if not user:
        return JsonResponse({"detail": "No user found with that email."}, status=404)

    if user.id == project.evaluator_id:
        return JsonResponse({"detail": "This user is already the evaluator."}, status=400)

    existing = ProjectMembership.objects.filter(project=project, user=user).first()
    if existing:
        return JsonResponse({"detail": "User is already a member."}, status=400)

    m = ProjectMembership.objects.create(project=project, user=user)
    return JsonResponse(
        {
            "id": m.id,
            "username": user.username,
            "email": user.email,
            "role": getattr(m, "role", "DEVELOPER"),
        },
        status=201,
    )


@login_required
@require_POST
def api_remove_member(request, project_id: int, membership_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not is_admin(request.user):
        return JsonResponse({"detail": "Only admin can manage members."}, status=403)

    membership = get_object_or_404(ProjectMembership, id=membership_id, project=project)

    if membership.user_id == project.evaluator_id:
        return JsonResponse({"detail": "Cannot remove the project evaluator."}, status=400)

    membership.delete()
    return JsonResponse({"ok": True})