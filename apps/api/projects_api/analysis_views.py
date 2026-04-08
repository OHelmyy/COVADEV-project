from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from apps.analysis.services.services import run_analysis_for_project
from apps.projects.models import Project

from .permissions import can_open_project


@login_required
@require_POST
def api_run_analysis(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Only project members can run analysis."}, status=403)

    if not project.active_bpmn:
        return JsonResponse({"detail": "Upload BPMN first (Evaluator)."}, status=400)

    if not project.active_code:
        return JsonResponse({"detail": "Upload Code ZIP first."}, status=400)

    try:
        run = run_analysis_for_project(project, matcher="greedy", top_k=3)
        return JsonResponse({
            "run": {
                "id": run.id,
                "status": run.status,
                "errorMessage": run.error_message,
            }
        })
    except Exception as e:
        return JsonResponse({"detail": f"Analysis failed: {e}"}, status=400)