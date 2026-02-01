from apps.analysis.metrics.developer_scoring import score_developers


def test_developer_scoring_mvp():
    matched = [
        {"taskId": "T1", "codeId": "C1", "similarity": 0.9},
        {"taskId": "T2", "codeId": "C2", "similarity": 0.8},
    ]
    extra = [
        {"codeId": "C3", "file": "", "symbol": ""},
    ]
    mapping = {"C1": "dev_a", "C2": "dev_b", "C3": "dev_a"}

    result = score_developers(matched, extra, mapping)
    devs = {d["developerId"]: d for d in result["developers"]}

    assert devs["dev_a"]["matched_count"] == 1
    assert devs["dev_a"]["extra_count"] == 1
    assert devs["dev_b"]["matched_count"] == 1
    assert devs["dev_b"]["extra_count"] == 0
