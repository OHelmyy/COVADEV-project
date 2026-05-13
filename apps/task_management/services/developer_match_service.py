from __future__ import annotations

import zipfile
import tempfile
from pathlib import Path
from typing import Optional

import numpy as np

from apps.analysis.embeddings.embedder import LocalEmbedder
from apps.analysis.models import BpmnTask, MatchResult, TaskEmbedding
from apps.analysis.code.structured_extractor import extract_structured_functions
from apps.analysis.summary.code_summary_service import SummaryService
from apps.task_management.models import DeveloperSubmission


def _cosine_similarity(a: list, b: list) -> float:
    av = np.asarray(a, dtype=float)
    bv = np.asarray(b, dtype=float)
    if av.size == 0 or bv.size == 0:
        return 0.0
    denom = (np.linalg.norm(av) * np.linalg.norm(bv)) or 1e-9
    return float(np.clip(np.dot(av, bv) / denom, -1.0, 1.0))


def _extract_summaries_from_zip(zip_path: Path) -> list[tuple[str, str]]:
    """
    Extract all Python functions from a ZIP, summarize each one.
    Returns list of (function_name, summary) tuples.
    """
    all_functions = []

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmp)

        for py_file in tmp.rglob("*.py"):
            try:
                functions = extract_structured_functions(py_file, project_root=tmp)
                all_functions.extend(functions)
            except Exception as e:
                print(f"[developer_match_service] Failed to extract {py_file.name}: {e}")

    if not all_functions:
        return []

    try:
        summaries_dict = SummaryService().summarize_many(all_functions)
        return [
            (sf.get("function_name", ""), summaries_dict.get(sf.get("function_uid", ""), ""))
            for sf in all_functions
            if summaries_dict.get(sf.get("function_uid", ""), "").strip()
        ]
    except Exception as e:
        print(f"[developer_match_service] SummaryService failed: {e}")
        return []


def match_accepted_developer_submission(submission: DeveloperSubmission) -> Optional[dict]:
    """
    Runs when an evaluator accepts a developer ZIP submission.
    Extracts functions, summarizes, embeds, compares vs task embedding,
    saves a MatchResult.
    """
    assignment = submission.assignment
    task: BpmnTask = assignment.bpmn_task
    project = submission.project

    embedder = LocalEmbedder()

    # Get or compute task embedding
    task_emb = TaskEmbedding.objects.filter(project=project, bpmn_task=task).first()
    if task_emb and task_emb.vector:
        task_vector = task_emb.vector
    else:
        task_text = (task.summary_text or task.description or task.name or "").strip()
        if not task_text:
            return None
        task_vector = embedder.embed_many([task_text])[0].vector
        TaskEmbedding.objects.update_or_create(
            project=project,
            bpmn_task=task,
            defaults={"vector": task_vector},
        )

    # Extract and summarize functions from ZIP
    zip_path = Path(submission.zip_file.path)
    name_summary_pairs = _extract_summaries_from_zip(zip_path)

    best_summary = ""
    best_score = 0.0

    if name_summary_pairs:
        summaries = [s for _, s in name_summary_pairs]
        code_embeddings = embedder.embed_many(summaries)
        scores = [_cosine_similarity(emb.vector, task_vector) for emb in code_embeddings]
        best_idx = int(max(range(len(scores)), key=lambda i: scores[i]))
        best_score = scores[best_idx]
        best_summary = summaries[best_idx]

    # Remove any old result for this task from a previous submission
    MatchResult.objects.filter(
        project=project, task=task, is_ai_generated=False,
        code_ref__startswith="Developer submission"
    ).delete()
    MatchResult.objects.filter(
        project=project, task=task, is_ai_generated=False, status="MISSING"
    ).delete()

    threshold = float(getattr(project, "similarity_threshold", 0.6) or 0.6)
    # Evaluator manually reviewed and accepted — always MATCHED
    status = "MATCHED"
    
    code_ref = (
        f"Developer submission #{submission.id} "
        f"(assignment #{assignment.id}, attempt {submission.attempt_number})"
    )

    match = MatchResult.objects.create(
        project=project,
        task=task,
        code_ref=code_ref,
        similarity_score=best_score,
        status=status,
        is_ai_generated=False,
        matched_summary=best_summary,
    )

    return {
        "match": match,
        "similarity": best_score,
        "threshold": threshold,
        "below_threshold": best_score < threshold,
    }