from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .embedder import LocalEmbedder, EmbeddingResult


@dataclass(frozen=True)
class EmbeddedRecord:
    """
    Unified embedded record for both BPMN tasks and code items.

    - id: stable identifier (task_id or code_item_id)
    - kind: "bpmn_task" | "code_item"
    - text: the exact text that was embedded
    - vector: embedding vector as list[float] (JSON-friendly)
    """
    id: str
    kind: str
    text: str
    vector: List[float]


def build_bpmn_text(task: Dict[str, Any]) -> str:
    """
    Build the semantic text for a BPMN task.

    Expected keys:
      - id, name, description, type
    """
    name = (task.get("name") or "").strip()
    desc = (task.get("description") or "").strip()
    ttype = (task.get("type") or "").strip()

    parts: List[str] = []
    if name:
        parts.append(f"Task: {name}.")
    if desc:
        parts.append(f"Description: {desc}.")
    if ttype:
        parts.append(f"Type: {ttype}.")

    return " ".join(parts).strip()


# apps/analysis/embeddings/pipeline.py

_BAD_GENERIC = (
    "returns a result",
    "does",
    "handles",
    "processes data",
    "performs",
)

def _is_too_generic(s: str) -> bool:
    s = (s or "").lower()
    return any(p in s for p in _BAD_GENERIC)


def build_code_text(item: Dict[str, Any]) -> str:
    """
    Build semantic text for a code item, aligned with BPMN wording.
    """

    # 1️⃣ Get name/title safely
    name = (
        (item.get("name") or "").strip()
        or (item.get("symbol") or "").strip()
    )
    kind = (item.get("type") or "").strip()

    # 2️⃣ Human-readable task title
    task_title = name.replace("_", " ").strip()
    if task_title:
        task_title = " ".join(w.capitalize() for w in task_title.split())

    # 3️⃣ Candidate summary (LLM-generated)
    summary = (item.get("summary_text") or "").strip()

    # ✅ HERE IS THE IMPORTANT PART
    # Use summary ONLY if it's meaningful
    if summary and not _is_too_generic(summary):
        if task_title:
            return f"Task: {task_title}. Description: {summary}."
        return f"Description: {summary}."

    # 4️⃣ Fallback: extractor text
    text = (item.get("text") or "").strip()
    if text:
        return text

    # 5️⃣ Last resort fallback
    if kind and name:
        return f"{kind}: {name}".strip()

    return name.strip()

def _collect_payloads(
    tasks: Sequence[Dict[str, Any]],
    code_items: Sequence[Dict[str, Any]],
) -> Tuple[List[Tuple[str, str]], List[Tuple[str, str]]]:
    """
    Convert inputs into payloads:
      - task_payloads: [(task_id, text), ...]
      - code_payloads: [(code_id, text), ...]
    """
    task_payloads: List[Tuple[str, str]] = []
    for t in tasks:
        tid = (t.get("id") or "").strip()
        if not tid:
            continue

        txt = build_bpmn_text(t)
        if not txt:
            # fallback to at least name + type
            fallback = " ".join(
                [
                    (t.get("name") or "").strip(),
                    (t.get("type") or "").strip(),
                ]
            ).strip()
            txt = fallback

        if txt:
            task_payloads.append((tid, txt))

    code_payloads: List[Tuple[str, str]] = []
    for it in code_items:
        cid = (it.get("id") or "").strip()
        if not cid:
            continue

        txt = build_code_text(it)
        if txt:
            code_payloads.append((cid, txt))

    return task_payloads, code_payloads


def embed_pipeline(
    *,
    tasks: Sequence[Dict[str, Any]],
    code_items: Sequence[Dict[str, Any]],
    embedder: Optional[LocalEmbedder] = None,
    batch_size: int = 32,
) -> Dict[str, Any]:
    """
    Day 4 pipeline (analysis-only):

    - takes parsed BPMN tasks + extracted code items
    - builds semantic texts
    - embeds both using LocalEmbedder
    - returns structured, JSON-friendly results

    Output:
    {
      "meta": {"model": "...", "dim": 384, "task_count": N, "code_count": M},
      "task_embeddings": [ {id, kind, text, vector}, ... ],
      "code_embeddings": [ {id, kind, text, vector}, ... ]
    }
    """
    embedder = embedder or LocalEmbedder()

    task_payloads, code_payloads = _collect_payloads(tasks, code_items)

    # ---- Embed BPMN tasks ----
    task_ids = [tid for tid, _ in task_payloads]
    task_texts = [txt for _, txt in task_payloads]
    task_vectors: List[EmbeddingResult] = embedder.embed_many(
        task_texts, batch_size=batch_size
    )

    embedded_tasks: List[EmbeddedRecord] = []
    for tid, res in zip(task_ids, task_vectors):
        embedded_tasks.append(
            EmbeddedRecord(
                id=tid,
                kind="bpmn_task",
                text=res.text,
                vector=res.vector,
            )
        )

    # ---- Embed code items ----
    code_ids = [cid for cid, _ in code_payloads]
    code_texts = [txt for _, txt in code_payloads]
    code_vectors: List[EmbeddingResult] = embedder.embed_many(
        code_texts, batch_size=batch_size
    )

    embedded_code: List[EmbeddedRecord] = []
    for cid, res in zip(code_ids, code_vectors):
        embedded_code.append(
            EmbeddedRecord(
                id=cid,
                kind="code_item",
                text=res.text,
                vector=res.vector,
            )
        )

    # Embedding dimension (safe query from the model)
    dim = int(embedder.model.get_sentence_embedding_dimension())

    return {
        "meta": {
            "model": embedder.model_name,
            "dim": dim,
            "task_count": len(embedded_tasks),
            "code_count": len(embedded_code),
        },
        "task_embeddings": [asdict(x) for x in embedded_tasks],
        "code_embeddings": [asdict(x) for x in embedded_code],
    }
