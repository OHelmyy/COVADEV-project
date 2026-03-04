# apps/analysis/summary/structured_summary.py
from __future__ import annotations

from typing import Any, Dict, List


def _short_list(xs: List[str], n: int = 4) -> str:
    xs = [str(x).strip() for x in (xs or []) if str(x).strip()]
    if not xs:
        return "none"
    cut = xs[:n]
    more = f" (+{len(xs) - n} more)" if len(xs) > n else ""
    return ", ".join(cut) + more


def build_structured_summary(sf: Dict[str, Any]) -> str:
    """
    Human-friendly explanation of the structured function object.
    This is NOT for embeddings; it's for UI/debug.
    """
    file_path = (sf.get("file_path") or "").strip()
    fn = (sf.get("function_name") or "").strip()
    sig = (sf.get("signature") or "").strip()
    cls = (sf.get("class_name") or "").strip()
    language = (sf.get("language") or "").strip()

    calls = sf.get("calls") or []
    writes = sf.get("writes") or []
    returns = sf.get("returns") or []
    exceptions = sf.get("exceptions") or []

    where = f"{file_path}" if file_path else "unknown file"
    owner = f"{cls}.{fn}" if cls and fn else (fn or "unknown_function")

    # Simple multi-line “explain like a human”
    lines: List[str] = []
    lines.append(f"{owner} ({language}) in {where}.")
    if sig:
        lines.append(f"Signature: {sig}.")
    lines.append(f"Calls: {_short_list(calls)}.")
    if writes:
        lines.append(f"Updates: {_short_list(writes)}.")
    if returns:
        lines.append(f"Returns: {_short_list(returns)}.")
    if exceptions:
        lines.append(f"May raise: {_short_list(exceptions)}.")

    return "\n".join(lines).strip()
