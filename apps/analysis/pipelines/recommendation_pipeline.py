from __future__ import annotations

from typing import Any, Dict, List

from apps.analysis.bpmn.recommender_local import (
    build_prompt,
    generate_recommendations_local,
)

from .base_pipeline import BasePipeline


class RecommendationPipeline(BasePipeline):
    """
    Template Method pipeline for BPMN-based recommendations.

    Flow:
      - validate summary
      - preprocess prompt
      - execute recommendation generation
      - build stable response
    """

    def __init__(self, summary: str) -> None:
        super().__init__()
        self.summary = (summary or "").strip()

        self.prompt: str = ""
        self.recommendations: List[str] = []
        self.error_message: str = ""

    def validate(self) -> None:
        if not self.summary:
            self.error_message = "Workflow summary is empty."

    def should_stop(self) -> bool:
        return bool(self.error_message)

    def load(self) -> None:
        # No external loading needed right now.
        return None

    def preprocess(self) -> None:
        self.prompt = build_prompt(self.summary)

    def execute(self) -> None:
        self.recommendations = generate_recommendations_local(self.summary)

    def save(self) -> None:
        # No DB persistence yet.
        return None

    def build_response(self) -> Dict[str, Any]:
        if self.error_message:
            return {
                "ok": False,
                "error": self.error_message,
                "recommendations": [],
                "meta": {
                    "count": 0,
                },
            }

        return {
            "ok": True,
            "error": "",
            "recommendations": self.recommendations,
            "meta": {
                "count": len(self.recommendations),
                "summary_used": self.summary,
                "prompt_used": self.prompt,
            },
        }