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
    Build the input block sent to the LLM.
    Code snippet comes first so LLM focuses on actual logic not the name.
    """
    function_name = sf.get("function_name") or "unknown"
    params = sf.get("parameters") or []
    calls = sf.get("calls") or []
    writes = sf.get("writes") or []
    returns = sf.get("returns") or []
    exceptions = sf.get("exceptions") or []
    snippet = (sf.get("raw_snippet") or "").strip()

    lines = []

    # Code FIRST — LLM reads actual logic before seeing the name
    if snippet:
        if len(snippet) > 1200:
            snippet = snippet[:1200] + "\n... (truncated)"
        lines.append("CODE:")
        lines.append(snippet)
        lines.append("")

    # Supporting signals
    if calls:
        lines.append(f"CALLS: {_join(calls)}")
    if writes:
        lines.append(f"WRITES: {_join(writes)}")
    if returns:
        lines.append(f"RETURNS: {_join(returns)}")
    if exceptions:
        lines.append(f"RAISES: {_join(exceptions)}")
    if params:
        lines.append(f"PARAMETERS: {_join(params)}")

    # Name LAST — so LLM doesn't anchor summary on it
    lines.append(f"FUNCTION_NAME: {function_name}")

    return "\n".join(lines)