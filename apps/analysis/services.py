
from __future__ import annotations
from typing import Dict, List
from .metrics.evaluation import evaluate_traceability
from .semantic.embedding_service import SemanticEmbeddingService


def compute_metrics_from_similarity_payload(payload: Dict) -> Dict:
    """
    This is the function your views need right now.
    It consumes the POST payload from the dashboard.
    """
    threshold = float(payload.get("threshold", 0.7))
    bpmn_tasks = payload.get("bpmn_tasks", []) or []
    code_items = payload.get("code_items", []) or []
    matches = payload.get("matches", []) or []

    return evaluate_traceability(
        bpmn_tasks=bpmn_tasks,
        code_items=code_items,
        matches=matches,
        threshold=threshold,
    )
def run_semantic_pipeline_for_project(project_id: int, threshold: float = 0.7) -> Dict:
    """
    End-to-end:
    Serag extraction -> MiniLM-L6 similarity -> metrics
    """

    # 1) ✅ SERAG extraction (update import path when he delivers)
    """from .semantic.serag_pipeline import extract_project_text  # example module name
    tasks, code_items = extract_project_text(project_id)"""

    # 2) Build texts
    task_texts = [(t.get("text") or t.get("taskName") or "").strip() for t in tasks]
    code_texts = [(c.get("text") or c.get("symbol") or "").strip() for c in code_items]

    # 3) If empty, return metrics safely (no crash)
    if not tasks or not code_items:
        payload = {"threshold": float(threshold), "bpmn_tasks": tasks, "code_items": code_items, "matches": []}
        return compute_metrics_from_similarity_payload(payload)

    # 4) MiniLM-L6 embeddings + cosine similarity
    embedder = SemanticEmbeddingService()
    sim_matrix = embedder.compute_similarity_matrix(task_texts, code_texts)

    # 5) Convert matrix -> flat matches list
    matches = []
    for i, t in enumerate(tasks):
        for j, c in enumerate(code_items):
            matches.append({
                "taskId": t["taskId"],
                "codeId": c["codeId"],
                "similarity": float(sim_matrix[i][j]),
            })

    # 6) Feed metrics
    payload = {
        "threshold": float(threshold),
        "bpmn_tasks": tasks,
        "code_items": code_items,
        "matches": matches,
    }


    return compute_metrics_from_similarity_payload(payload)

