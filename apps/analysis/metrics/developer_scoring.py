from __future__ import annotations

from typing import Dict, List


def score_developers(
    matched: List[Dict],
    extra: List[Dict],
    code_to_developer: Dict[str, str],
) -> Dict:
    """
    matched: [{taskId, codeId, similarity}]
    extra:   [{codeId, file, symbol}]
    code_to_developer: {codeId: developerId}

    Output is UI-ready.
    """
    matched_by_dev: Dict[str, int] = {}
    extra_by_dev: Dict[str, int] = {}

    for m in matched:
        dev = code_to_developer.get(m["codeId"], "unassigned")
        matched_by_dev[dev] = matched_by_dev.get(dev, 0) + 1

    for e in extra:
        dev = code_to_developer.get(e["codeId"], "unassigned")
        extra_by_dev[dev] = extra_by_dev.get(dev, 0) + 1

    dev_ids = set(matched_by_dev.keys()) | set(extra_by_dev.keys())
    total_matched = sum(matched_by_dev.values())

    developers = []
    for dev in sorted(dev_ids):
        mc = matched_by_dev.get(dev, 0)
        ec = extra_by_dev.get(dev, 0)
        score_raw = mc - ec
        score = (max(0, score_raw) / max(1, total_matched)) * 100.0
        developers.append(
            {
                "developerId": dev,
                "matched_count": mc,
                "extra_count": ec,
                "score_raw": score_raw,
                "score": float(score),
            }
        )

    return {
        "developers": developers,
        "totals": {"total_matched": int(total_matched), "total_extra": int(sum(extra_by_dev.values()))},
    }
