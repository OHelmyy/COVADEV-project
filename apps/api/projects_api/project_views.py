from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from apps.accounts.rbac import is_admin, is_evaluator
from apps.projects.models import Project, ProjectMembership

from .permissions import can_open_project
from .serializers import json_project_detail, json_project_summary


@login_required
@require_http_methods(["GET", "POST"])
def api_projects_list_create(request):
    if request.method == "GET":
        if is_admin(request.user):
            projects = Project.objects.all().order_by("-created_at")
            data = [json_project_summary(p, request.user) for p in projects]
            return JsonResponse(data, safe=False)

        if is_evaluator(request.user):
            projects = Project.objects.filter(evaluator=request.user).order_by("-created_at")
            data = [json_project_summary(p, request.user) for p in projects]
            return JsonResponse(data, safe=False)

        projects = Project.objects.filter(memberships__user=request.user).distinct().order_by("-created_at")
        data = [json_project_summary(p, request.user) for p in projects]
        return JsonResponse(data, safe=False)

    if not is_admin(request.user):
        return JsonResponse({"detail": "Only admin can create projects."}, status=403)

    name = (request.POST.get("name") or "").strip()
    description = (request.POST.get("description") or "").strip()
    threshold = (request.POST.get("similarity_threshold") or "0.6").strip()

    evaluator_email = (request.POST.get("evaluatorEmail") or "").strip().lower()
    developer_emails_raw = (request.POST.get("developerEmails") or "").strip()
    developer_emails = [e.strip().lower() for e in developer_emails_raw.split(",") if e.strip()]

    if not name:
        return JsonResponse({"detail": "Project name is required."}, status=400)

    if not evaluator_email:
        return JsonResponse({"detail": "evaluatorEmail is required."}, status=400)

    try:
        threshold_value = float(threshold)
        if threshold_value <= 0 or threshold_value >= 1:
            raise ValueError()
    except Exception:
        return JsonResponse({"detail": "Threshold must be between 0 and 1 (e.g., 0.6)."}, status=400)

    evaluator = (
        User.objects.filter(username=evaluator_email).first()
        or User.objects.filter(email=evaluator_email).first()
    )
    if not evaluator:
        return JsonResponse({"detail": "Evaluator user not found."}, status=404)

    if not is_evaluator(evaluator):
        return JsonResponse({"detail": "Selected user is not an evaluator."}, status=400)

    project = Project.objects.create(
        name=name,
        description=description,
        created_by=request.user,
        evaluator=evaluator,
        similarity_threshold=threshold_value,
    )

    for email in developer_emails:
        dev = User.objects.filter(username=email).first() or User.objects.filter(email=email).first()
        if not dev:
            continue
        if dev.id == evaluator.id:
            continue

        profile = getattr(dev, "profile", None)
        if profile and getattr(profile, "role", None) != "DEVELOPER":
            continue

        ProjectMembership.objects.get_or_create(project=project, user=dev)

    return JsonResponse(json_project_summary(project, request.user), status=201)



@login_required
@require_http_methods(["GET", "DELETE"])
def api_project_detail_or_delete(request, project_id: int):
    project = get_object_or_404(
        Project.objects.select_related("active_bpmn", "active_code", "evaluator"),
        id=project_id,
    )
    if request.method == "DELETE":
        if not is_admin(request.user):
            return JsonResponse({"detail": "Admin only."}, status=403)
        project.delete()
        return JsonResponse({"ok": True})

    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    return JsonResponse(json_project_detail(project, request.user))


@login_required
@require_http_methods(["POST"])
def api_delete_project(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not is_admin(request.user):
        return JsonResponse({"detail": "Only admin can delete this project."}, status=403)

    project.delete()
    return JsonResponse({"ok": True})
