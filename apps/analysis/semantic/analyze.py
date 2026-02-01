from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Union

from apps.analysis.bpmn.parser import extract_bpmn_graph, extract_tasks
from apps.analysis.code.extractor import extract_python_from_directory
from apps.analysis.code.react_extractor import extract_react_from_directory
from apps.analysis.embeddings.pipeline import embed_pipeline
from apps.analysis.semantic.similarity import compute_similarity, top_k_matches
from apps.analysis.semantic.matcher import greedy_one_to_one_match, best_per_task_match


def _ensure_path(p: Union[str, Path]) -> Path:
    return p if isinstance(p, Path) else Path(p)


def analyze_project(
    *,
    bpmn_input: Union[str, Path, bytes],
    code_root: Union[str, Path],
    threshold: float = 0.55,
    matcher: str = "greedy",  # "greedy" | "best_per_task"
    top_k: int = 3,
    batch_size: int = 32,
    include_debug: bool = False,
) -> Dict[str, Any]:
    """
    End-to-end analysis entrypoint.

    Light output by default (Django/React friendly).
    If include_debug=True, returns embeddings + full similarity matrix too.

    Returns (light):
    {
      "meta": {...},
      "bpmn": {...},
      "code": {"items": [...]},
      "matching": {...},
      "top_k": {...},
      "stats": {...},
      "debug": {...}   # only when include_debug=True
    }
    """
    code_root_path = _ensure_path(code_root)

    # ----------------------------
    # 1) BPMN graph + tasks
    # ----------------------------
    bpmn_graph = extract_bpmn_graph(bpmn_input)

    # Keep backward-compatible tasks list too (some consumers might expect it)
    bpmn_tasks = bpmn_graph.get("tasks") or extract_tasks(bpmn_input)

    # ----------------------------
    # 2) Code extraction (Python + React)
    # ----------------------------
    py_items = extract_python_from_directory(code_root_path, project_root=code_root_path)
    react_items = extract_react_from_directory(code_root_path, project_root=code_root_path)
    code_items: List[Dict[str, Any]] = [*py_items, *react_items]

    # ----------------------------
    # 3) Embeddings (Day 4)
    # ----------------------------
    embedded = embed_pipeline(
        tasks=bpmn_tasks,
        code_items=code_items,
        batch_size=batch_size,
    )

    # ----------------------------
    # 4) Similarity (Day 5)
    # ----------------------------
    sim = compute_similarity(
        task_embeddings=embedded["task_embeddings"],
        code_embeddings=embedded["code_embeddings"],
    )

    # ----------------------------
    # 5) Top-K (UI/debug helper)
    # ----------------------------
    top = top_k_matches(similarity=sim, k=int(top_k))

    # ----------------------------
    # 6) Matching (Day 6–7)
    # ----------------------------
    matcher_norm = (matcher or "").strip().lower()
    if matcher_norm == "best_per_task":
        matching = best_per_task_match(similarity=sim, threshold=float(threshold))
    else:
        matching = greedy_one_to_one_match(similarity=sim, threshold=float(threshold))
        matcher_norm = "greedy"

    # ----------------------------
    # 7) Stable output contract (light)
    # ----------------------------
    matched_list = matching.get("matched") or []
    missing_list = matching.get("missing") or []
    extra_list = matching.get("extra") or []

    result: Dict[str, Any] = {
        "meta": {
            "matcher": matcher_norm,
            "threshold": float(threshold),
            "top_k": int(top_k),
            "batch_size": int(batch_size),
        },
        "bpmn": bpmn_graph,  # includes tasks/events/gateways/flows
        "code": {"items": code_items},
        "matching": matching,  # includes meta + matched/missing/extra
        "top_k": top,
        "stats": {
            "task_count": len(bpmn_tasks),
            "code_count": len(code_items),
            "matched_count": len(matched_list),
            "missing_count": len(missing_list),
            "extra_count": len(extra_list),
        },
    }

    # ----------------------------
    # 8) Optional heavy debug output
    # ----------------------------
    if include_debug:
        result["debug"] = {
            "embeddings_meta": embedded.get("meta"),
            "task_embeddings": embedded.get("task_embeddings"),
            "code_embeddings": embedded.get("code_embeddings"),
            "similarity": sim,  # includes full matrix
        }

    return result
