from __future__ import annotations
from typing import Any, Dict
from apps.analysis.bpmn.recommender_local import run_recommendation_pipeline
from apps.analysis.models import BpmnRecommendations
from apps.api.projects_api.helpers import get_project_bpmn_summary

def run_recommendation_for_project(project, *, force: bool = False) -> Dict[str, Any]:
    """
    Application flow for project recommendations.

    Orchestrates:
      1) load BPMN summary
      2) use cache if valid
      3) run recommendation pipeline
      4) persist recommendations
    """
    summary = get_project_bpmn_summary(project)
    if not summary:
        raise ValueError("No BPMN summary found.")

    rec, _ = BpmnRecommendations.objects.get_or_create(project=project)

    if (
        (not force)
        and rec.recommendations_text.strip()
        and (rec.source_summary or "").strip() == summary.strip()
    ):
        return {
            "ok": True,
            "cached": True,
            "engine": "cache",
            "recommendations": rec.as_list(),
            "updated_at": rec.updated_at,
            "summary": summary,
        }

    pipeline_result = run_recommendation_pipeline(summary)
    if not pipeline_result.get("ok", False):
        raise ValueError(pipeline_result.get("error") or "Recommendation generation failed.")

    items = pipeline_result.get("recommendations", []) or []

    rec.recommendations_text = "\n".join(items)
    rec.source_summary = summary
    rec.save(update_fields=["recommendations_text", "source_summary", "updated_at"])

    return {
        "ok": True,
        "cached": False,
        "engine": "pipeline",
        "recommendations": rec.as_list(),
        "updated_at": rec.updated_at,
        "summary": summary,
    }