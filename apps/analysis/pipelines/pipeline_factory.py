from __future__ import annotations

from .predev_pipeline import PreDevPipeline
from .postdev_pipeline import PostDevPipeline
from .recommendation_pipeline import RecommendationPipeline


class PipelineFactory:
    """
    Factory responsible for creating the correct pipeline object.
    """

    @staticmethod
    def create_predev(*, bpmn_bytes: bytes, do_summary: bool = True) -> PreDevPipeline:
        return PreDevPipeline(
            bpmn_bytes=bpmn_bytes,
            do_summary=do_summary,
        )

    @staticmethod
    def create_postdev(
        *,
        project,
        matcher: str = "greedy",
        top_k: int = 3,
        abs_media_path_resolver,
        code_root_resolver,
        replace_bpmn_tasks_func,
        replace_match_results_func,
    ) -> PostDevPipeline:
        return PostDevPipeline(
            project=project,
            matcher=matcher,
            top_k=top_k,
            abs_media_path_resolver=abs_media_path_resolver,
            code_root_resolver=code_root_resolver,
            replace_bpmn_tasks_func=replace_bpmn_tasks_func,
            replace_match_results_func=replace_match_results_func,
        )

    @staticmethod
    def create_recommendation(*, summary: str) -> RecommendationPipeline:
        return RecommendationPipeline(summary=summary)