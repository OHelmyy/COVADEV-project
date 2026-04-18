from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import numpy as np
from apps.analysis.bpmn.parser import extract_bpmn_graph, extract_tasks
from apps.analysis.embeddings.pipeline import embed_pipeline
from apps.analysis.semantic.similarity import compute_similarity, top_k_matches
from apps.analysis.semantic.matcher import greedy_one_to_one_match, best_per_task_match
from apps.analysis.models_code import CodeArtifact


# -------------------------------------------------
# Path helpers
# -------------------------------------------------

def _ensure_path(p: Union[str, Path]) -> Path:
    return p if isinstance(p, Path) else Path(p)


def _norm_abs(p: Path) -> Path:
    return p.resolve(strict=False)


def _is_inside(child: Path, parent: Path) -> bool:
    child = _norm_abs(child)
    parent = _norm_abs(parent)
    try:
        child.relative_to(parent)
        return True
    except Exception:
        return False


def _safe_relpath(file_path_raw: str, code_root_path: Union[str, Path]) -> Optional[str]:
    if not file_path_raw:
        return None
    root = _norm_abs(_ensure_path(code_root_path))
    fp = Path(str(file_path_raw).strip())
    abs_fp = _norm_abs(root / fp) if not fp.is_absolute() else _norm_abs(fp)
    if not _is_inside(abs_fp, root):
        return None
    rel = abs_fp.relative_to(root)
    return rel.as_posix()


def _artifact_rel_or_skip(artifact_file_path: str, code_root_path: Union[str, Path]) -> Optional[str]:
    fp = (artifact_file_path or "").strip()
    if not fp:
        return None
    p = Path(fp)
    root = _ensure_path(code_root_path)
    if not p.is_absolute():
        return _safe_relpath(fp, root)
    return _safe_relpath(fp, root)


# -------------------------------------------------
# Text helpers
# -------------------------------------------------
def _humanize_symbol(symbol: str) -> str:
    s = (symbol or "").strip().replace("_", " ")
    if not s:
        return ""
    return s[:1].upper() + s[1:]


def _fallback_symbol_from_uid(uid: str) -> str:
    uid = (uid or "").strip()
    if "::" in uid:
        right = uid.split("::", 1)[1]
    else:
        right = uid
    if "@" in right:
        right = right.split("@", 1)[0]
    right = right.split(":")[-1]
    return right.strip() or "unknown"


# -------------------------------------------------
# Sub-functions (refactored by other developer)
# -------------------------------------------------

def analyze_bpmn_side(
    *,
    bpmn_input: Union[str, Path, bytes],
    project=None,
    bpmn_graph_override: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """BPMN-only stage."""
    bpmn_graph = bpmn_graph_override if bpmn_graph_override is not None else extract_bpmn_graph(bpmn_input)

    if project is not None:
        from apps.analysis.models import BpmnTask as BpmnTaskModel
        db_tasks = BpmnTaskModel.objects.filter(project=project)
        if db_tasks.exists():
            bpmn_tasks = [
                {
                    "id": t.task_id,
                    "name": t.name,
                    "description": t.summary_text or t.description or "",
                }
                for t in db_tasks
            ]
        else:
            print("WARNING: No BpmnTask rows found in DB for this project. "
                  "Falling back to raw BPMN parsing — task descriptions will be empty, "
                  "similarity scores may be unreliable.")
            bpmn_tasks = bpmn_graph.get("tasks") or extract_tasks(bpmn_input) or []
    else:
        bpmn_tasks = bpmn_graph.get("tasks") or extract_tasks(bpmn_input) or []

    print("\n" + "="*60)
    print("BPMN TASK SUMMARIES (going into embedder)")
    print("="*60)
    for t in bpmn_tasks:
        print(f"  Task : {t.get('name')}")
        print(f"  Text : {t.get('description')}")
        print()
    print("="*60)

    return {
        "bpmn_graph": bpmn_graph,
        "bpmn_tasks": bpmn_tasks,
    }


def analyze_code_side(
    *,
    code_root: Union[str, Path],
    project=None,
) -> Dict[str, Any]:
    """Code-only stage."""
    code_root_path = _norm_abs(_ensure_path(code_root))

    code_items: List[Dict[str, Any]] = []
    used_persisted = False

    if project is not None:
        artifacts = list(
            CodeArtifact.objects.filter(project=project).order_by("file_path", "symbol")
        )

        if artifacts:
            filtered: List[CodeArtifact] = []
            for a in artifacts:
                rel = _artifact_rel_or_skip(a.file_path or "", code_root_path)
                if not rel:
                    continue
                a.file_path = rel
                filtered.append(a)

            if filtered:
                used_persisted = True
                for a in filtered:
                    symbol = (a.symbol or "").strip() or _fallback_symbol_from_uid(a.code_uid)
                    summary_text = (a.summary_text or "").strip() or "Implements its main behavior based on available code context."

                    print("\n----------- CODE SUMMARY -----------")
                    print(f"Function: {symbol}")
                    print(f"Summary: {summary_text}")
                    print("------------------------------------")

                    code_items.append(
                        {
                            "id": a.code_uid,
                            "type": a.kind or "function",
                            "name": symbol,
                            "source_path": a.file_path or "",
                            "summary_text": summary_text,
                            "text": f"Description: {summary_text}.",
                        }
                    )

    print("CODE SUMMARIES (going into embedder)")
    print("="*60)
    for item in code_items:
        print(f"  Symbol  : {item.get('name')}")
        print(f"  Summary : {item.get('summary_text')}")
        print()
    print("="*60 + "\n")

    return {
        "code_root_path": code_root_path,
        "code_items": code_items,
        "used_persisted": used_persisted,
    }


def match_bpmn_code(
    *,
    bpmn_tasks: List[Dict[str, Any]],
    code_items: List[Dict[str, Any]],
    threshold: float = 0.6,
    matcher: str = "greedy",
    top_k: int = 3,
    batch_size: int = 32,
    project=None,
) -> Dict[str, Any]:
    """Embedding + similarity + matching only."""

    # Load cached embeddings from DB
    cached_task_vecs = {}
    cached_code_vecs = {}

    if project is not None:
        from apps.analysis.models import TaskEmbedding, CodeEmbedding

        for emb in TaskEmbedding.objects.filter(project=project).select_related("bpmn_task"):
            cached_task_vecs[emb.bpmn_task.task_id] = emb.vector

        for emb in CodeEmbedding.objects.filter(project=project).select_related("code_artifact"):
            cached_code_vecs[emb.code_artifact.code_uid] = emb.vector

    tasks_to_embed = [t for t in bpmn_tasks if t["id"] not in cached_task_vecs]
    code_to_embed = [c for c in code_items if c["id"] not in cached_code_vecs]

    if tasks_to_embed or code_to_embed:
        new_embedded = embed_pipeline(
            tasks=tasks_to_embed,
            code_items=code_to_embed,
            batch_size=batch_size,
        )
    else:
        new_embedded = {"task_embeddings": [], "code_embeddings": [], "meta": {}}
        

    # Merge cached + newly computed
    all_task_embeddings = []
    for t in bpmn_tasks:
        if t["id"] in cached_task_vecs:
            all_task_embeddings.append({"id": t["id"], "vector": cached_task_vecs[t["id"]]})
        else:
            match = next(
                (e for e in new_embedded["task_embeddings"] if e["id"] == t["id"]), None
            )
            if match:
                all_task_embeddings.append(match)

    all_code_embeddings = []
    for c in code_items:
        if c["id"] in cached_code_vecs:
            all_code_embeddings.append({"id": c["id"], "vector": cached_code_vecs[c["id"]]})
        else:
            match = next(
                (e for e in new_embedded["code_embeddings"] if e["id"] == c["id"]), None
            )
            if match:
                all_code_embeddings.append(match)

    embedded = {
        "task_embeddings": all_task_embeddings,
        "code_embeddings": all_code_embeddings,
        "meta": new_embedded.get("meta", {}),
    }

    similarity = compute_similarity(
        task_embeddings=embedded["task_embeddings"],
        code_embeddings=embedded["code_embeddings"],
    )

    matcher_norm = (matcher or "").strip().lower()
    if matcher_norm == "best_per_task":
        matching = best_per_task_match(similarity=similarity, threshold=float(threshold))
    else:
        matcher_norm = "greedy"
        matching = greedy_one_to_one_match(similarity=similarity, threshold=float(threshold))

    return {
        "matcher_norm": matcher_norm,
        "embedded": embedded,
        "similarity": similarity,
        "matching": matching,
        "top_k": top_k_matches(similarity=similarity, k=int(top_k)),
    }


# -------------------------------------------------
# Main
# -------------------------------------------------

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
    bpmn_graph_override: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """
    Core semantic engine.
    Compares BPMN TASKS ↔ Code function summaries.
    """

    bpmn_result = analyze_bpmn_side(
        bpmn_input=bpmn_input,
        project=project,
        bpmn_graph_override=bpmn_graph_override,
    )
    bpmn_graph = bpmn_result["bpmn_graph"] #used for ui display
    bpmn_tasks = bpmn_result["bpmn_tasks"] #used for embedding and matching

    if not bpmn_tasks:
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

    code_result = analyze_code_side(
        code_root=code_root,
        project=project,
    )
    code_root_path = code_result["code_root_path"]
    code_items = code_result["code_items"] #used for embedding and matching
    used_persisted = code_result["used_persisted"]

    if not code_items:
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

    match_result = match_bpmn_code(
        bpmn_tasks=bpmn_tasks,
        code_items=code_items,
        threshold=threshold,
        matcher=matcher,
        top_k=top_k,
        batch_size=batch_size,
        project=project,
    )

    matching = match_result["matching"]
    similarity = match_result["similarity"]
    embedded = match_result["embedded"]
    matcher_norm = match_result["matcher_norm"]
    top_k_result = match_result["top_k"]

    matched_list = matching.get("matched") or []
    missing_list = matching.get("missing") or []
    extra_list = matching.get("extra") or []

    #saving the results in a dict to be returned as JSON response to frontend
    result: Dict[str, Any] = {
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
            "matched": len(matched_list),
            "missing": len(missing_list),
            "extra": len(extra_list),
        },
        "_embedded": embedded,
    }

    if include_debug:
        result["debug"] = {
            "code_root": str(code_root_path),
            "embedding_meta": embedded.get("meta"),
            "similarity_meta": similarity.get("meta"),
        }

    return result