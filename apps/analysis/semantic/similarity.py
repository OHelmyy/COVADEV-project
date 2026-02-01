from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Sequence, Tuple

import numpy as np


@dataclass(frozen=True)
class SimilarityMeta:
    """
    Metadata for similarity computation.
    """
    metric: str  # "cosine"
    task_count: int
    code_count: int


def _to_matrix(vectors: Sequence[Sequence[float]]) -> np.ndarray:
    """
    Convert list[list[float]] to numpy matrix of shape (N, D).
    """
    mat = np.asarray(vectors, dtype=float)
    if mat.ndim != 2:
        raise ValueError("vectors must be a 2D list/array with shape (N, D)")
    return mat


def cosine_similarity_matrix(
    task_vectors: Sequence[Sequence[float]],
    code_vectors: Sequence[Sequence[float]],
) -> np.ndarray:
    """
    Compute cosine similarity matrix between tasks and code items.

    Assumptions:
    - vectors are already L2-normalized (because embedder used normalize_embeddings=True)
    - so cosine similarity = dot product

    Returns:
    - matrix S with shape (num_tasks, num_code_items)
    """
    T = _to_matrix(task_vectors)  # (N, D)
    C = _to_matrix(code_vectors)  # (M, D)

    if T.shape[1] != C.shape[1]:
        raise ValueError(f"Vector dim mismatch: tasks dim={T.shape[1]} vs code dim={C.shape[1]}")

    # If embeddings are normalized, cosine similarity is just dot product:
    # S[i, j] = dot(T[i], C[j])
    S = T @ C.T  # (N, M)

    # Numerical safety: clip to [-1, 1] (tiny float errors)
    return np.clip(S, -1.0, 1.0)


def compute_similarity(
    *,
    task_embeddings: Sequence[Dict[str, Any]],
    code_embeddings: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Compute similarity scores between embedded tasks and embedded code items.

    Expected embedding record fields:
      - id
      - vector (list[float])
      - (optional) text, kind

    Returns JSON-friendly structure:
    {
      "meta": {...},
      "task_ids": [...],
      "code_ids": [...],
      "matrix": [[...], [...], ...]   # shape (N, M)
    }
    """
    task_ids: List[str] = [str(x.get("id")) for x in task_embeddings]
    code_ids: List[str] = [str(x.get("id")) for x in code_embeddings]

    task_vecs: List[List[float]] = [list(x.get("vector") or []) for x in task_embeddings]
    code_vecs: List[List[float]] = [list(x.get("vector") or []) for x in code_embeddings]

    if not task_vecs or not code_vecs:
        meta = SimilarityMeta(metric="cosine", task_count=len(task_vecs), code_count=len(code_vecs))
        return {
            "meta": asdict(meta),
            "task_ids": task_ids,
            "code_ids": code_ids,
            "matrix": [],
        }

    S = cosine_similarity_matrix(task_vecs, code_vecs)  # (N, M)

    meta = SimilarityMeta(metric="cosine", task_count=S.shape[0], code_count=S.shape[1])

    return {
        "meta": asdict(meta),
        "task_ids": task_ids,
        "code_ids": code_ids,
        "matrix": S.astype(float).tolist(),
    }


def top_k_matches(
    *,
    similarity: Dict[str, Any],
    k: int = 3,
) -> Dict[str, List[Tuple[str, float]]]:
    """
    Utility: for each task, return top-k code ids with highest similarity.

    Returns:
    {
      "<task_id>": [("<code_id>", score), ...],
      ...
    }
    """
    task_ids: List[str] = list(similarity.get("task_ids") or [])
    code_ids: List[str] = list(similarity.get("code_ids") or [])
    matrix: List[List[float]] = list(similarity.get("matrix") or [])

    if not matrix:
        return {tid: [] for tid in task_ids}

    S = np.asarray(matrix, dtype=float)  # (N, M)
    N, M = S.shape

    k_eff = max(0, min(int(k), M))

    results: Dict[str, List[Tuple[str, float]]] = {}
    for i in range(N):
        row = S[i]  # (M,)
        # argsort ascending -> take last k -> reverse for descending
        idx = np.argsort(row)[-k_eff:][::-1]
        results[task_ids[i]] = [(code_ids[j], float(row[j])) for j in idx]

    return results
