from __future__ import annotations
from typing import Dict, List, Tuple

from .metrics import alignment_pct, precision, recall, f1_score


def evaluate_traceability(
    bpmn_tasks: List[Dict],
    code_items: List[Dict],
    matches: List[Dict],
    threshold: float,
) -> Dict:
    """
    Takes:
      bpmn_tasks: [{taskId, taskName}]
      code_items: [{codeId, file, symbol}]
      matches:    [{taskId, codeId, similarity}]
    Produces:
      matched (best per task above threshold)
      missing (tasks with no match)
      extra (code not used by any matched)
      + summary metrics
    """

    # index
    tasks_by_id = {t["taskId"]: t for t in bpmn_tasks if t.get("taskId")}
    code_by_id = {c["codeId"]: c for c in code_items if c.get("codeId")}

    # group matches by task
    by_task: Dict[str, List[Dict]] = {}
    for m in matches:
        tid = m.get("taskId")
        if not tid:
            continue
        by_task.setdefault(tid, []).append(m)

    matched: List[Dict] = []
    missing: List[Dict] = []
    used_code_ids = set()

    for tid, task in tasks_by_id.items():
        candidates = by_task.get(tid, [])
        if not candidates:
            missing.append({"taskId": tid, "taskName": task.get("taskName", ""), "reason": "no candidates"})
            continue

        # best similarity
        best = max(candidates, key=lambda x: float(x.get("similarity", 0.0)))
        best_score = float(best.get("similarity", 0.0))

        if best_score >= float(threshold):
            cid = best.get("codeId")
            used_code_ids.add(cid)

            code = code_by_id.get(cid, {})
            matched.append({
                "taskId": tid,
                "taskName": task.get("taskName", ""),
                "codeId": cid,
                "file": code.get("file", ""),
                "symbol": code.get("symbol", ""),
                "similarity": best_score,
            })
        else:
            missing.append({
                "taskId": tid,
                "taskName": task.get("taskName", ""),
                "reason": f"best below threshold ({best_score:.3f} < {threshold})",
            })

    extra: List[Dict] = []
    for cid, code in code_by_id.items():
        if cid not in used_code_ids:
            extra.append({
                "codeId": cid,
                "file": code.get("file", ""),
                "symbol": code.get("symbol", ""),
                "reason": "unused by best matches",
            })

    total_tasks = len(tasks_by_id)
    matched_count = len(matched)
    missing_count = len(missing)
    extra_count = len(extra)

    # Simple TP/FP/FN definition (common in traceability demos):
    # TP = matched_count
    # FN = missing_count
    # FP = extra_count
    tp, fn, fp = matched_count, missing_count, extra_count

    p = precision(tp, fp)
    r = recall(tp, fn)
    f1 = f1_score(p, r)
    align = alignment_pct(matched_count, total_tasks)

    return {
        "summary": {
            "total_tasks": total_tasks,
            "matched_count": matched_count,
            "missing_count": missing_count,
            "extra_count": extra_count,
            "alignment": align,
            "precision": p,
            "recall": r,
            "f1": f1,
            "threshold": float(threshold),
        },
        "details": {
            "matched": matched,
            "missing": missing,
            "extra": extra,
        }
    }
