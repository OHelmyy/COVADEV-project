from apps.analysis.metrics.metrics import BPMNTask, CodeItem, Match
from apps.analysis.metrics.metrics import compute_alignment, compute_precision_recall_f1
from apps.analysis.metrics.evaluation import classify, compute_summary


def test_alignment():
    assert compute_alignment(5, 10) == 50.0
    assert compute_alignment(0, 10) == 0.0
    assert compute_alignment(10, 10) == 100.0


def test_precision_recall_f1():
    prf = compute_precision_recall_f1(tp=5, fp=5, fn=5)
    assert round(prf["precision"], 3) == 0.5
    assert round(prf["recall"], 3) == 0.5
    assert round(prf["f1"], 3) == 0.5


def test_classification_and_summary():
    tasks = [BPMNTask("T1", "A"), BPMNTask("T2", "B"), BPMNTask("T3", "C")]
    code = [CodeItem("C1"), CodeItem("C2"), CodeItem("C3")]
    matches = [
        Match("T1", "C1", 0.9),
        Match("T2", "C2", 0.8),
        Match("T3", "C2", 0.6),  # below threshold => missing
    ]

    details = classify(tasks, code, matches, threshold=0.7)
    assert len(details["matched"]) == 2
    assert len(details["missing"]) == 1
    assert len(details["extra"]) == 1  # C3 unused

    summary = compute_summary(details, total_tasks=len(tasks))
    assert summary["matched_count"] == 2
    assert summary["missing_count"] == 1
    assert summary["extra_count"] == 1
    assert round(summary["alignment"], 2) == round((2 / 3) * 100, 2)
