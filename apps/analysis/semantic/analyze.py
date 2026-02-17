# apps/analysis/semantic/analyze.py
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import numpy as np
from django.db import transaction

from apps.analysis.bpmn.parser import extract_bpmn_graph, extract_tasks
from apps.analysis.bpmn.pipeline import run_bpmn_predev

from apps.analysis.code.structured_extractor import extract_structured_from_directory
from apps.analysis.summary.service import SummaryService
from apps.analysis.summary.structured_summary import build_structured_summary

from apps.analysis.embeddings.pipeline import embed_pipeline
from apps.analysis.embeddings.embedder import LocalEmbedder

from apps.analysis.semantic.similarity import compute_similarity, top_k_matches
from apps.analysis.semantic.matcher import greedy_one_to_one_match, best_per_task_match

from apps.analysis.models_code import CodeArtifact


# -------------------------------------------------
# Path helpers
# -------------------------------------------------

def _ensure_path(p: Union[str, Path]) -> Path:
    return p if isinstance(p, Path) else Path(p)

def _norm_abs(p: Path) -> Path:
    # resolve(strict=False) so it won't crash if file doesn't exist anymore
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
    """
    Return normalized relative path under code_root_path.
    If file is outside code_root_path -> None (means: skip).
    Works with both absolute/relative file_path_raw.
    """
    if not file_path_raw:
        return None

    root = _norm_abs(_ensure_path(code_root_path))
    fp = Path(str(file_path_raw).strip())

    # Make absolute
    abs_fp = _norm_abs(root / fp) if not fp.is_absolute() else _norm_abs(fp)

    if not _is_inside(abs_fp, root):
        return None

    rel = abs_fp.relative_to(root)
    return rel.as_posix()

def _artifact_rel_or_skip(artifact_file_path: str, code_root_path: Union[str, Path]) -> Optional[str]:
    """
    Artifacts should be stored RELATIVE.
    But if you already have old rows with absolute paths, we allow them ONLY if inside code_root.
    Returns a relative path (posix) or None if should be skipped.
    """
    fp = (artifact_file_path or "").strip()
    if not fp:
        return None

    p = Path(fp)
    root = _ensure_path(code_root_path)

    # If already relative -> accept and normalize
    if not p.is_absolute():
        # also prevent weird ../ escapes
        rel = _safe_relpath(fp, root)
        return rel  # might be None if it escapes

    # absolute -> must be inside
    return _safe_relpath(fp, root)


# -------------------------------------------------
# Text helpers
# -------------------------------------------------

def _to_bytes(bpmn_input: Union[str, Path, bytes]) -> bytes:
    if isinstance(bpmn_input, (bytes, bytearray)):
        return bytes(bpmn_input)
    p = bpmn_input if isinstance(bpmn_input, Path) else Path(str(bpmn_input))
    return p.read_bytes()

def _cosine_1_to_many(vec: np.ndarray, mat: np.ndarray) -> np.ndarray:
    """
    vec: (D,)
    mat: (N, D)
    returns: (N,)
    """
    vec = vec.astype(np.float32)
    mat = mat.astype(np.float32)

    v_norm = np.linalg.norm(vec) + 1e-12
    m_norm = np.linalg.norm(mat, axis=1) + 1e-12
    return (mat @ vec) / (m_norm * v_norm)

def _humanize_symbol(symbol: str) -> str:
    s = (symbol or "").strip().replace("_", " ")
    if not s:
        return ""
    return s[:1].upper() + s[1:]

def _fallback_symbol_from_uid(uid: str) -> str:
    """
    Example uid: "bpmn\\parser.py::extract_bpmn_graph@L120-L227"
    """
    uid = (uid or "").strip()
    if "::" in uid:
        right = uid.split("::", 1)[1]
    else:
        right = uid
    if "@" in right:
        right = right.split("@", 1)[0]
    right = right.split(":")[-1]
    return right.strip() or "unknown"

def _fallback_summary(sf: Dict[str, Any]) -> str:
    """
    Non-hallucinating fallback when the LLM summary fails.
    Keeps UI usable and allows matching to proceed.
    """
    fn = (sf.get("function_name") or "").strip() or _fallback_symbol_from_uid(str(sf.get("function_uid") or ""))
    fn_h = _humanize_symbol(fn) or "Function"

    calls = sf.get("calls") or []
    writes = sf.get("writes") or []
    returns = sf.get("returns") or []

    bits: List[str] = []
    if calls:
        bits.append("calls other routines")
    if writes:
        bits.append("updates data")
    if returns:
        bits.append("returns a result")

    tail = ", ".join(bits) if bits else "implements its main behavior based on available code context"
    return f"{fn_h} {tail}."


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
    run=None,
) -> Dict[str, Any]:
    """
    Core semantic engine.

    Compares:
    - BPMN TASKS ↔ Code function summaries
    - BPMN WORKFLOW SUMMARY ↔ Code function summaries
    """

    code_root_path = _norm_abs(_ensure_path(code_root))

    # -------------------------------------------------
    # 1) BPMN parsing
    # -------------------------------------------------
    bpmn_graph = extract_bpmn_graph(bpmn_input)
    bpmn_tasks = bpmn_graph.get("tasks") or extract_tasks(bpmn_input) or []

    # -------------------------------------------------
    # 2) BPMN workflow summary (PRE-DEV output)
    # -------------------------------------------------
    bpmn_summary = ""
    try:
        bpmn_bytes = _to_bytes(bpmn_input)
        predev = run_bpmn_predev(bpmn_bytes, do_summary=True)
        bpmn_summary = (predev.get("summary") or "").strip()
    except Exception:
        bpmn_summary = ""

    # -------------------------------------------------
    # 3) Load persisted CodeArtifacts (FAST PATH)
    #    ✅ FILTER to only those under uploaded code_root
    # -------------------------------------------------
    code_items: List[Dict[str, Any]] = []
    used_persisted = False

    if project is not None:
        artifacts = list(CodeArtifact.objects.filter(project=project).order_by("file_path", "symbol"))
        if artifacts:
            filtered: List[CodeArtifact] = []
            for a in artifacts:
                rel = _artifact_rel_or_skip(a.file_path or "", code_root_path)
                if not rel:
                    continue
                # normalize stored path to rel for embedding pipeline
                a.file_path = rel
                filtered.append(a)

            if filtered:
                used_persisted = True
                for a in filtered:
                    symbol = (a.symbol or "").strip() or _fallback_symbol_from_uid(a.code_uid)
                    summary_text = (a.summary_text or "").strip() or "Implements its main behavior based on available code context."
                    human_title = _humanize_symbol(symbol) or "Unnamed Function"

                    code_items.append(
                        {
                            "id": a.code_uid,
                            "type": a.kind or "function",
                            "name": symbol,
                            "source_path": a.file_path or "",  # ✅ relative
                            "summary_text": summary_text,
                            "structured_summary": (a.structured_summary or "").strip(),
                            "text": f"Task: {human_title}. Description: {summary_text}",
                        }
                    )

    # -------------------------------------------------
    # 4) If no persisted artifacts, extract + summarize (SLOW PATH)
    #    ✅ Only keep & persist files inside code_root
    #    ✅ Persist file_path as RELATIVE
    # -------------------------------------------------
    structured_functions: List[Dict[str, Any]] = []
    summaries_by_uid: Dict[str, str] = {}
    summary_errors: Dict[str, str] = {}

    if not code_items:
        structured_functions = extract_structured_from_directory(code_root_path, project_root=code_root_path) or []

        summarizer = SummaryService()
        try:
            res_all = summarizer.summarize_many(structured_functions)  # {uid: {short,detailed}}
        except Exception as e:
            res_all = {}
            summary_errors["__GLOBAL__"] = str(e)

        # Build UI structured summaries
        structured_ui: Dict[str, str] = {}
        for sf in structured_functions:
            uid = (sf.get("function_uid") or "").strip()
            if not uid:
                continue
            try:
                structured_ui[uid] = build_structured_summary(sf)
            except Exception:
                structured_ui[uid] = ""

        # Build code_items
        for sf in structured_functions:
            uid = (sf.get("function_uid") or "").strip()
            if not uid:
                continue

            # ✅ filter to uploaded code only
            file_path_raw = (sf.get("file_path") or "").strip()
            rel_path = _safe_relpath(file_path_raw, code_root_path)
            if not rel_path:
                continue

            val = res_all.get(uid)
            short = ""
            detailed = ""

            if isinstance(val, dict):
                short = (val.get("short") or "").strip()
                detailed = (val.get("detailed") or "").strip()
            elif val:
                short = str(val).strip()

            if not short:
                short = _fallback_summary(sf)
                summary_errors[uid] = "Empty/failed model summary (fallback used)"

            summaries_by_uid[uid] = short

            fn_name = (sf.get("function_name") or "").strip() or _fallback_symbol_from_uid(uid)
            human_title = _humanize_symbol(fn_name) or "Unnamed Function"

            code_items.append(
                {
                    "id": uid,
                    "type": (sf.get("kind") or "function").strip() or "function",
                    "name": fn_name,
                    "source_path": rel_path,  # ✅ relative
                    "summary_text": short,
                    "structured_summary": structured_ui.get(uid, "") or detailed,
                    "text": f"Task: {human_title}. Description: {short}",
                }
            )

        # Persist artifacts for next runs (only uploaded code)
        if project is not None and structured_functions:
            with transaction.atomic():
                for sf in structured_functions:
                    uid = (sf.get("function_uid") or "").strip()
                    if not uid:
                        continue

                    file_path_raw = (sf.get("file_path") or "").strip()
                    rel_path = _safe_relpath(file_path_raw, code_root_path)
                    if not rel_path:
                        continue

                    fn_name = (sf.get("function_name") or "").strip() or _fallback_symbol_from_uid(uid)

                    summary_text = (summaries_by_uid.get(uid) or "").strip() or _fallback_summary(sf)

                    try:
                        structured_ui_text = build_structured_summary(sf)
                    except Exception:
                        structured_ui_text = ""

                    CodeArtifact.objects.update_or_create(
                        project=project,
                        code_uid=uid,
                        defaults={
                            "file_path": rel_path,  # ✅ RELATIVE ONLY
                            "language": (sf.get("language") or "python").strip() or "python",
                            "symbol": fn_name,
                            "kind": (sf.get("kind") or "function").strip() or "function",
                            "raw_snippet": sf.get("raw_snippet") or "",
                            "calls": sf.get("calls") or [],
                            "writes": sf.get("writes") or [],
                            "returns": sf.get("returns") or [],
                            "exceptions": sf.get("exceptions") or [],
                            "summary_text": summary_text,
                            "structured_summary": structured_ui_text,
                        },
                    )

    # -------------------------------------------------
    # 5) TASK ↔ CODE embeddings
    # -------------------------------------------------
    embedded = embed_pipeline(
        tasks=bpmn_tasks,
        code_items=code_items,
        batch_size=batch_size,
    )

    # -------------------------------------------------
    # 6) Task-level similarity + matching
    # -------------------------------------------------
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

    # -------------------------------------------------
    # 7) Workflow summary ↔ code similarity (optional)
    # -------------------------------------------------
    workflow_top: List[Dict[str, Any]] = []
    if bpmn_summary and (embedded.get("code_embeddings") or []):
        try:
            embedder = LocalEmbedder()
            workflow_vec = np.array(embedder.embed_one(f"workflow: {bpmn_summary}"), dtype=np.float32)

            code_embs = embedded.get("code_embeddings") or []
            code_ids = [str(c.get("id") or "") for c in code_embs]
            code_vecs = np.array([c.get("vector") for c in code_embs], dtype=np.float32)

            scores = _cosine_1_to_many(workflow_vec, code_vecs)

            pairs: List[Dict[str, Any]] = []
            for uid, sc in zip(code_ids, scores.tolist()):
                if uid:
                    pairs.append({"code_id": uid, "score": float(sc)})

            workflow_top = sorted(pairs, key=lambda x: x["score"], reverse=True)[: int(top_k)]
        except Exception:
            workflow_top = []

    # -------------------------------------------------
    # 8) Output (NO vectors)
    # -------------------------------------------------
    matched_list = matching.get("matched") or []
    missing_list = matching.get("missing") or []
    extra_list = matching.get("extra") or []

    # Prefer structured_functions count if slow-path, else code_items
    stats_structured = len(structured_functions) if structured_functions else len(code_items)

    result: Dict[str, Any] = {
        "meta": {
            "matcher": matcher_norm,
            "threshold": float(threshold),
            "top_k": int(top_k),
            "batch_size": int(batch_size),
            "used_persisted_code_artifacts": bool(used_persisted),
        },
        "bpmn": bpmn_graph,
        "bpmn_summary": bpmn_summary,
        "workflow_similarity": workflow_top,
        "code": {"items": code_items},
        "matching": matching,
        "top_k": top_k_matches(similarity=similarity, k=int(top_k)),
        "stats": {
            "tasks": len(bpmn_tasks),
            "structured_functions": int(stats_structured),
            "code_count_embedded": len(code_items),
            "matched": len(matched_list),
            "missing": len(missing_list),
            "extra": len(extra_list),
        },
    }

    if summary_errors:
        result["summary_status"] = {
            "ok": len(summary_errors) == 0,
            "errors_sample": dict(list(summary_errors.items())[:5]),
        }

    if include_debug:
        result["debug"] = {
            "code_root": str(code_root_path),
            "embedding_meta": embedded.get("meta"),
            "similarity_meta": similarity.get("meta"),
        }

    return result
