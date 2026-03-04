# apps/analysis/summary/generator.py
from __future__ import annotations

from typing import Any, Dict, List


def _join(items: List[str], limit: int = 12) -> str:
    items = [str(x).strip() for x in (items or []) if str(x).strip()]
    if not items:
        return "—"
    if len(items) > limit:
        items = items[:limit] + ["..."]
    return " | ".join(items)


def build_generator_block(sf: Dict[str, Any]) -> str:
    """
    Convert a structured_function dict into a compact, model-friendly block.
    Only include fields we actually have to avoid hallucination.
    """
    function_name = sf.get("function_name") or "unknown"
    signature = sf.get("signature") or ""
    file_path = sf.get("file_path") or ""
    class_name = sf.get("class_name") or ""
    params = sf.get("parameters") or []
    calls = sf.get("calls") or []
    writes = sf.get("writes") or []
    returns = sf.get("returns") or []
    exceptions = sf.get("exceptions") or []
    snippet = (sf.get("raw_snippet") or "").strip()

    lines = []
    lines.append(f"FUNCTION_NAME: {function_name}")
    if signature:
        lines.append(f"SIGNATURE: {signature}")
    if class_name:
        lines.append(f"CLASS: {class_name}")
    if file_path:
        lines.append(f"FILE: {file_path}")
    if params:
        lines.append(f"PARAMETERS: {_join(params)}")
    if calls:
        lines.append(f"CALLS: {_join(calls)}")
    if writes:
        lines.append(f"WRITES: {_join(writes)}")
    if returns:
        lines.append(f"RETURNS: {_join(returns)}")
    if exceptions:
        lines.append(f"EXCEPTIONS: {_join(exceptions)}")

    # give snippet last (most informative)
    if snippet:
        # keep it short-ish to reduce token usage
        if len(snippet) > 1200:
            snippet = snippet[:1200] + "\n... (truncated)"
        lines.append("CODE_SNIPPET:")
        lines.append(snippet)

    return "\n".join(lines)
