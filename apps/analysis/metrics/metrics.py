from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


def safe_div(n: float, d: float) -> float:
    return 0.0 if d == 0 else float(n) / float(d)


def precision(tp: int, fp: int) -> float:
    return safe_div(tp, tp + fp)


def recall(tp: int, fn: int) -> float:
    return safe_div(tp, tp + fn)


def f1_score(p: float, r: float) -> float:
    return 0.0 if (p + r) == 0 else 2 * p * r / (p + r)


def alignment_pct(matched: int, total_tasks: int) -> float:
    return 0.0 if total_tasks == 0 else (matched / total_tasks) * 100.0
