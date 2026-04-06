from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from apps.analysis.services.services import run_bpmn_upload_flow
from apps.projects.models import Project
from apps.projects.services import save_code_zip_and_extract

from .permissions import can_open_project, is_project_evaluator
from .serializers import json_file_payload


@login_required
@require_POST
def api_upload_bpmn(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not is_project_evaluator(project, request.user):
        return JsonResponse({"detail": "Only evaluator can upload BPMN."}, status=403)

    f = request.FILES.get("bpmn_file")
    if not f:
        return JsonResponse({"detail": "Missing bpmn_file."}, status=400)

    try:
        result = run_bpmn_upload_flow(project, f, request.user)

        return JsonResponse({
            "ok": True,
            "activeBpmn": json_file_payload(result["active_bpmn"]),
        })

    except Exception as e:
        return JsonResponse({"detail": f"BPMN upload failed: {e}"}, status=400)


@login_required
@require_POST
def api_upload_code_zip(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Only project members can upload code ZIP."}, status=403)

    z = request.FILES.get("code_zip")
    if not z:
        return JsonResponse({"detail": "Missing code_zip."}, status=400)

    try:
        save_code_zip_and_extract(project, z, request.user)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"detail": f"Code ZIP upload failed: {e}"}, status=400)