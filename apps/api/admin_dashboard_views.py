from django.http import JsonResponse
from django.views.decorators.http import require_GET

from django.contrib.auth.models import User
from apps.projects.models import Project
from apps.accounts.models import UserProfile


def _is_admin(user):
    return user.is_authenticated and getattr(getattr(user, "profile", None), "role", "") == UserProfile.Role.ADMIN


@require_GET
def admin_dashboard(request):
    if not _is_admin(request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    total_users = User.objects.count()
    total_projects = Project.objects.count()
    total_admins = UserProfile.objects.filter(role="ADMIN").count()
    total_evaluators = UserProfile.objects.filter(role="EVALUATOR").count()
    total_developers = UserProfile.objects.filter(role="DEVELOPER").count()

    return JsonResponse({
        "stats": {
            "totalUsers": total_users,
            "totalProjects": total_projects,
            "admins": total_admins,
            "evaluators": total_evaluators,
            "developers": total_developers,
        }
    })