from __future__ import annotations

from typing import Any, Dict, List

from apps.analysis.bpmn.recommender_local import (
    build_prompt,
    generate_recommendations_local,
)


class RecommendationPipeline:
    """
    Factory-based pipeline for BPMN-based recommendations.

    Flow:
      - validate summary
      - preprocess prompt
      - execute recommendation generation
      - build stable response
    """

    def __init__(self, summary: str) -> None:
        self.summary = (summary or "").strip()

        self.prompt: str = ""
        self.recommendations: List[str] = []
        self.error_message: str = ""

    def run(self) -> Dict[str, Any]:
        self._validate()

        if self.error_message:
            return self._build_error_response()

        self._preprocess()
        self._execute()

        return self._build_success_response()

    def _validate(self) -> None:
        if not self.summary:
            self.error_message = "Workflow summary is empty."

    def _preprocess(self) -> None:
        self.prompt = build_prompt(self.summary)

    def _execute(self) -> None:
        self.recommendations = generate_recommendations_local(self.summary)

    def _build_error_response(self) -> Dict[str, Any]:
        return {
            "ok": False,
            "error": self.error_message,
            "recommendations": [],
            "meta": {
                "count": 0,
            },
        }

    def _build_success_response(self) -> Dict[str, Any]:
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