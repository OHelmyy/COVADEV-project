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

#the vector we got from the embedder
def _to_matrix(vectors: Sequence[Sequence[float]]) -> np.ndarray:
    """
    Convert list[list[float]] to numpy matrix of shape (N, D).
    """
    mat = np.asarray(vectors, dtype=float)
    #array([
    #[0.1, 0.2, 0.3],
    #[0.4, 0.5, 0.6],
    #[0.7, 0.8, 0.9]
    #])
    if mat.ndim != 2:
        raise ValueError("vectors must be a 2D list/array with shape (N, D)")
    return mat


def cosine_similarity_matrix(
    task_vectors: Sequence[Sequence[float]],
    code_vectors: Sequence[Sequence[float]],
) -> np.ndarray:

    T = _to_matrix(task_vectors)  # (N, D) Task vectors
    C = _to_matrix(code_vectors)  # (M, D) Code vectors

    if T.shape[1] != C.shape[1]:
        raise ValueError(f"Vector dim mismatch: tasks dim={T.shape[1]} vs code dim={C.shape[1]}")

    S = T @ C.T  # (N, M) #the second T flips rows and columns

    #          Code1   Code2
    #       ----------------
    #Task1     0.67    0.97
    #Task2     0.80    0.40

    return np.clip(S, -1.0, 1.0)
    #values should be between -1 and 1

def compute_similarity(
    *,
    task_embeddings: Sequence[Dict[str, Any]],
    code_embeddings: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Compute similarity scores between embedded tasks and embedded code items.

    Returns 
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
    similarity: Dict[str, Any], #output of compute_similarity
    k: int = 3, #number of top matches to return per task
) -> Dict[str, List[Tuple[str, float]]]:

    task_ids: List[str] = list(similarity.get("task_ids") or [])
    code_ids: List[str] = list(similarity.get("code_ids") or [])
    matrix: List[List[float]] = list(similarity.get("matrix") or [])

    if not matrix:
        return {tid: [] for tid in task_ids}

    S = np.asarray(matrix, dtype=float)  # (N, M)
    N, M = S.shape #N = number of tasks, M = number of code items

    k_eff = max(0, min(int(k), M))

    results: Dict[str, List[Tuple[str, float]]] = {}
    for i in range(N):
        row = S[i]  # (M,)
        # argsort ascending -> take last k -> reverse for descending
        idx = np.argsort(row)[-k_eff:][::-1]
        results[task_ids[i]] = [(code_ids[j], float(row[j])) for j in idx]
        
        #results["t1"] = [
        #("c1", 0.9), ("c2", 0.8), ("c3", 0.3)
        #]
    return results
