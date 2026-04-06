from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from apps.analysis.models import BpmnRecommendations
from apps.analysis.services.services import run_recommendation_for_project
from apps.projects.models import Project

from .helpers import get_project_bpmn_summary
from .permissions import can_open_project


@login_required
@require_http_methods(["GET", "POST"])
def api_project_recommendations(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    summary = get_project_bpmn_summary(project)

    if request.method == "GET":
        rec = getattr(project, "bpmn_recommendations", None)
        return JsonResponse({
            "projectId": project.id,
            "hasSummary": bool(summary),
            "recommendations": (rec.as_list() if rec else []),
            "updatedAt": rec.updated_at.isoformat() if rec else None,
            "sourceHash": (hash((rec.source_summary or "").strip()) if rec else None),
        })

    force = (request.GET.get("force") or request.POST.get("force") or "").lower() in ("1", "true", "yes")

    try:
        result = run_recommendation_for_project(project, force=force)

        return JsonResponse({
            "ok": True,
            "cached": bool(result["cached"]),
            "engine": result["engine"],
            "recommendations": result["recommendations"],
            "updatedAt": result["updated_at"].isoformat() if result["updated_at"] else None,
        })

    except Exception as e:
        return JsonResponse({"detail": f"Recommendation flow failed: {type(e).__name__}: {e}"}, status=500)