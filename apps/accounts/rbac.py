from functools import wraps
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404

from apps.projects.models import Project, ProjectMembership

def role_of(user) -> str:
    if not user.is_authenticated:
        return "ANON"
    prof = getattr(user, "profile", None)
    return getattr(prof, "role", "DEVELOPER")

def is_admin(user) -> bool:
    return role_of(user) == "ADMIN"

def is_evaluator(user) -> bool:
    return role_of(user) == "EVALUATOR"

def is_developer(user) -> bool:
    return role_of(user) == "DEVELOPER"

def can_open_project(user, project: Project) -> bool:
    if is_admin(user):
        return True
    if is_evaluator(user) and project.evaluator_id == user.id:
        return True
    if is_developer(user) and ProjectMembership.objects.filter(project=project, user=user).exists():
        return True
    return False

def require_admin(view):
    @wraps(view)
    def _w(request, *args, **kwargs):
        if not is_admin(request.user):
            return HttpResponseForbidden("Admin only.")
        return view(request, *args, **kwargs)
    return _w

def require_evaluator_for_project(view):
    @wraps(view)
    def _w(request, project_id, *args, **kwargs):
        project = get_object_or_404(Project, id=project_id)
        if is_admin(request.user) or (is_evaluator(request.user) and project.evaluator_id == request.user.id):
            return view(request, project_id, *args, **kwargs)
        return HttpResponseForbidden("Evaluator only for this project.")
    return _w

def require_developer_for_project(view):
    @wraps(view)
    def _w(request, project_id, *args, **kwargs):
        project = get_object_or_404(Project, id=project_id)
        if is_admin(request.user) or ProjectMembership.objects.filter(project=project, user=request.user).exists():
            return view(request, project_id, *args, **kwargs)
        return HttpResponseForbidden("Developer only for this project.")
    return _w
