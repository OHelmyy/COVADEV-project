from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Union

from apps.analysis.semantic.analyze import (
    analyze_bpmn_side,
    analyze_code_side,
    match_bpmn_code,
)


class SemanticAnalysisFacade:
    """
    Facade for the semantic analysis subsystem.
    """

    @staticmethod
    def analyze_bpmn(
        *,
        bpmn_input: Union[str, Path, bytes],
        project=None,
    ) -> Dict[str, Any]:
        return analyze_bpmn_side(
            bpmn_input=bpmn_input,
            project=project,
        )

    @staticmethod
    def analyze_code(
        *,
        code_root: Union[str, Path],
        project=None,
    ) -> Dict[str, Any]:
        return analyze_code_side(
            code_root=code_root,
            project=project,
        )

    @staticmethod
    def analyze_project(
        *,
        bpmn_input: Union[str, Path, bytes],
        code_root: Union[str, Path],
        threshold: float = 0.6,
        matcher: str = "greedy",
        top_k: int = 3,
        batch_size: int = 32,
        include_debug: bool = False,
        project=None,
    ) -> Dict[str, Any]:
        bpmn_result = SemanticAnalysisFacade.analyze_bpmn(
            bpmn_input=bpmn_input,
            project=project,
        )
        error = _validate_bpmn_result(bpmn_result)
        if error:
            return error

        code_result = SemanticAnalysisFacade.analyze_code(
            code_root=code_root,
            project=project,
        )
        error = _validate_code_result(code_result, bpmn_result)
        if error:
            return error

        match_result = _run_matching(
            bpmn_result=bpmn_result,
            code_result=code_result,
            threshold=threshold,
            matcher=matcher,
            top_k=top_k,
            batch_size=batch_size,
        )

        result = _build_response(
            bpmn_result=bpmn_result,
            code_result=code_result,
            match_result=match_result,
            threshold=threshold,
            top_k=top_k,
            batch_size=batch_size,
        )

        if include_debug:
            _attach_debug(result, code_result, match_result)

        return result


def _validate_bpmn_result(bpmn_result: Dict[str, Any]) -> Dict[str, Any] | None:
    tasks = bpmn_result.get("bpmn_tasks") or []

    if tasks:
        return None

    return {
        "error": "No BPMN tasks found. Please check the uploaded BPMN.",
        "stats": {
            "tasks": 0,
            "code_count_embedded": 0,
            "matched": 0,
            "missing": 0,
            "extra": 0,
        },
    }


def _validate_code_result(
    code_result: Dict[str, Any],
    bpmn_result: Dict[str, Any],
) -> Dict[str, Any] | None:
    code_items = code_result.get("code_items") or []
    bpmn_tasks = bpmn_result.get("bpmn_tasks") or []

    if code_items:
        return None

    return {
        "error": "No code artifacts found. Please upload code first.",
        "stats": {
            "tasks": len(bpmn_tasks),
            "code_count_embedded": 0,
            "matched": 0,
            "missing": 0,
            "extra": 0,
        },
    }


def _run_matching(
    *,
    bpmn_result: Dict[str, Any],
    code_result: Dict[str, Any],
    threshold: float,
    matcher: str,
    top_k: int,
    batch_size: int,
) -> Dict[str, Any]:
    return match_bpmn_code(
        bpmn_tasks=bpmn_result["bpmn_tasks"],
        code_items=code_result["code_items"],
        threshold=threshold,
        matcher=matcher,
        top_k=top_k,
        batch_size=batch_size,
    )


def _build_response(
    *,
    bpmn_result: Dict[str, Any],
    code_result: Dict[str, Any],
    match_result: Dict[str, Any],
    threshold: float,
    top_k: int,
    batch_size: int,
) -> Dict[str, Any]:
    bpmn_graph = bpmn_result["bpmn_graph"]
    bpmn_tasks = bpmn_result["bpmn_tasks"]
    code_items = code_result["code_items"]
    used_persisted = code_result["used_persisted"]

    matching = match_result["matching"]
    matcher_norm = match_result["matcher_norm"]
    top_k_result = match_result["top_k"]

    matched = matching.get("matched") or []
    missing = matching.get("missing") or []
    extra = matching.get("extra") or []

    return {
        "meta": {
            "matcher": matcher_norm,
            "threshold": float(threshold),
            "top_k": int(top_k),
            "batch_size": int(batch_size),
            "used_persisted_code_artifacts": bool(used_persisted),
        },
        "bpmn": bpmn_graph,
        "code": {"items": code_items},
        "matching": matching,
        "top_k": top_k_result,
        "stats": {
            "tasks": len(bpmn_tasks),
            "code_count_embedded": len(code_items),
            "matched": len(matched),
            "missing": len(missing),
            "extra": len(extra),
        },
    }


def _attach_debug(
    result: Dict[str, Any],
    code_result: Dict[str, Any],
    match_result: Dict[str, Any],
) -> None:
    result["debug"] = {
        "code_root": str(code_result["code_root_path"]),
        "embedding_meta": (match_result.get("embedded") or {}).get("meta"),
        "similarity_meta": (match_result.get("similarity") or {}).get("meta"),
    }