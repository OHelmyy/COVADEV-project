from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Sequence, Tuple

import numpy as np


@dataclass(frozen=True)
class MatchMeta:
    """
    Metadata about the matching run.
    """
    threshold: float
    strategy: str  # "greedy_one_to_one" | "best_per_task_many_to_one"


@dataclass(frozen=True)
class MatchPair:
    """
    A single match record between one BPMN task and one code item.
    """
    task_id: str
    code_id: str
    score: float


def _validate_similarity(similarity: Dict[str, Any]) -> Tuple[List[str], List[str], np.ndarray]:

    task_ids = list(similarity.get("task_ids") or [])
    code_ids = list(similarity.get("code_ids") or [])
    matrix = similarity.get("matrix") or []

    S = np.asarray(matrix, dtype=float)

    # If empty matrix, return a safe empty (N, M) matrix (can happen if no embeddings).
    if S.size == 0:
        return task_ids, code_ids, np.zeros((len(task_ids), len(code_ids)), dtype=float)

    if S.ndim != 2:
        raise ValueError("similarity['matrix'] must be a 2D matrix (list of lists)")

    if S.shape[0] != len(task_ids) or S.shape[1] != len(code_ids):
        raise ValueError(
            f"matrix shape {S.shape} does not match ids "
            f"(tasks={len(task_ids)}, code={len(code_ids)})"
        )

    return task_ids, code_ids, S


def greedy_one_to_one_match(
    *,
    similarity: Dict[str, Any],
    threshold: float,
) -> Dict[str, Any]:
    """
    Greedy one-to-one matcher (recommended default):
    - Consider all (task, code) pairs with score >= threshold
    - Sort pairs by score descending
    - Assign pair if:
        - task is not assigned yet
        - code is not assigned yet

    Output:
    {
      "meta": {...},
      "matched": [ {task_id, code_id, score}, ... ],
      "missing": [ "<task_id>", ... ],
      "extra":   [ "<code_id>", ... ]
    }
    """
    task_ids, code_ids, S = _validate_similarity(similarity)

    n_tasks, n_code = S.shape
        #       c1     c2     c3
        #t1     0.90   0.20   0.40
        #t2     0.80   0.85   0.10
        #t3     0.30   0.70   0.95
    thr = float(threshold)

    # 1) Build candidate list of all pairs above threshold
    candidates: List[Tuple[float, int, int]] = []  # (score, task_i, code_j)
    for i in range(n_tasks):
        for j in range(n_code):
            score = float(S[i, j])
            if score >= thr:
                candidates.append((score, i, j))

                #candidates = [
                #    (0.90, 0, 0),
                #    (0.80, 1, 0),
                #    (0.85, 1, 1),
                #    (0.95, 2, 2),
                #]

    # 2) Sort best-first
    candidates.sort(key=lambda x: x[0], reverse=True)

                #[
                #    (0.95, 2, 2),
                #    (0.90, 0, 0),
                #    (0.85, 1, 1),
                #    (0.80, 1, 0),
                #]
    # 3) Greedy assignment while preserving one-to-one constraint
    assigned_tasks = set()
    assigned_code = set()
    matches: List[MatchPair] = []

    for score, i, j in candidates:
        if i in assigned_tasks:
            continue
        if j in assigned_code:
            continue

        assigned_tasks.add(i)
        assigned_code.add(j)
        matches.append(MatchPair(task_id=task_ids[i], code_id=code_ids[j], score=score))

    # 4) Missing tasks = tasks that got no match
    missing = [task_ids[i] for i in range(n_tasks) if i not in assigned_tasks]

    # 5) Extra code = code items that were not used by any match
    extra = [code_ids[j] for j in range(n_code) if j not in assigned_code]

    meta = MatchMeta(threshold=thr, strategy="greedy_one_to_one")

    return {
        "meta": asdict(meta),
        "matched": [asdict(m) for m in matches],
        "missing": missing,
        "extra": extra,
    }


def best_per_task_match(
    *,
    similarity: Dict[str, Any],
    threshold: float,
) -> Dict[str, Any]:
    """
    Best-per-task matcher (many-to-one allowed):
    - For each task, pick the single best code item (argmax in the row)
    - Accept it if score >= threshold
    - A code item can be matched to multiple tasks

    Useful if you want "traceability to best code per task" without uniqueness.

    Output is same shape as greedy matcher.
    """
    task_ids, code_ids, S = _validate_similarity(similarity)

    n_tasks, n_code = S.shape
    thr = float(threshold)
        #       c1     c2     c3
        #t1     0.90   0.20   0.40
        #t2     0.85   0.70   0.10
        #t3     0.30   0.95   0.80
    matches: List[MatchPair] = []

    for i in range(n_tasks):
        if n_code == 0:
            continue
        #S[0] = [0.90, 0.20, 0.40]
        j = int(np.argmax(S[i]))  # best code index for this task
        score = float(S[i, j])
        #np.argmax([0.90, 0.20, 0.40]) = 0
        if score >= thr:
            matches.append(MatchPair(task_id=task_ids[i], code_id=code_ids[j], score=score))

    matched_task_ids = {m.task_id for m in matches}
    used_code_ids = {m.code_id for m in matches}

    missing = [tid for tid in task_ids if tid not in matched_task_ids]
    extra = [cid for cid in code_ids if cid not in used_code_ids]

    meta = MatchMeta(threshold=thr, strategy="best_per_task_many_to_one")

    return {
        "meta": asdict(meta),
        "matched": [asdict(m) for m in matches],
        "missing": missing,
        "extra": extra,
    }
