from __future__ import annotations

import threading
from typing import Optional

import numpy as np

from apps.analysis.embeddings.embedder import LocalEmbedder
from apps.analysis.models import BpmnTask, MatchResult, TaskEmbedding
from apps.task_management.models import TaskAssignment, AISubmission


# Lazy-loaded singleton embedder so we don't reload the model on every accept.
_embedder_lock = threading.Lock()
_embedder_instance: Optional[LocalEmbedder] = None


def _get_embedder() -> LocalEmbedder:
    global _embedder_instance
    if _embedder_instance is None:
        with _embedder_lock:
            if _embedder_instance is None:
                _embedder_instance = LocalEmbedder()
    return _embedder_instance


def _build_ai_code_text(submission: AISubmission, max_chars: int = 6000) -> str:
    """
    Combine the AI explanation + each file's content into one string for embedding.
    Truncates so we don't exceed the embedder's token limit.
    """
    parts = []
    if submission.explanation:
        parts.append("EXPLANATION: " + submission.explanation.strip())

    for f in submission.files.all().order_by("filename"):
        parts.append(f"--- {f.filename} ---")
        parts.append(f.content)

    text = "\n".join(parts)
    if len(text) > max_chars:
        text = text[:max_chars] + "\n... (truncated)"
    return text


def _cosine_similarity(a: list, b: list) -> float:
    av = np.asarray(a, dtype=float)
    bv = np.asarray(b, dtype=float)
    if av.size == 0 or bv.size == 0:
        return 0.0
    denom = (np.linalg.norm(av) * np.linalg.norm(bv)) or 1e-9
    return float(np.clip(np.dot(av, bv) / denom, -1.0, 1.0))


def match_accepted_ai_submission(assignment: TaskAssignment) -> Optional[MatchResult]:
    """
    Called when the evaluator accepts an AI submission. Computes semantic
    similarity between the AI's code and the assigned task summary, then
    saves a MatchResult flagged as AI-generated.

    Returns the MatchResult on success, None if there's no submission to match.
    """
    if not assignment.developer_membership.is_ai_agent:
        return None

    submission = (
        assignment.ai_submissions
        .prefetch_related("files")
        .order_by("-created_at")
        .first()
    )
    if submission is None:
        return None

    task: BpmnTask = assignment.bpmn_task
    project = assignment.project

    # 1. Build the AI code text and embed it.
    code_text = _build_ai_code_text(submission)
    embedder = _get_embedder()
    code_embedding = embedder.embed_many([code_text])[0]

    # 2. Get (or compute) the task embedding so we compare in the same vector space.
    task_emb = TaskEmbedding.objects.filter(project=project, bpmn_task=task).first()
    if task_emb is not None and task_emb.vector:
        task_vector = task_emb.vector
    else:
        task_text = (task.summary_text or task.description or task.name or "").strip()
        if not task_text:
            return None
        task_embedding_result = embedder.embed_many([task_text])[0]
        task_vector = task_embedding_result.vector
        # Cache it so future analysis runs reuse it
        TaskEmbedding.objects.update_or_create(
            project=project,
            bpmn_task=task,
            defaults={"vector": task_vector},
        )

    # 3. Compute cosine similarity.
    similarity = _cosine_similarity(code_embedding.vector, task_vector)

   # 4. Clean up any previous rows for this task that AI now supersedes:
    #    - Any existing AI row for this task (we replace it).
    #    - Any pipeline-generated MISSING row (the task is no longer missing).
    MatchResult.objects.filter(
        project=project, task=task, is_ai_generated=True
    ).delete()
    MatchResult.objects.filter(
        project=project, task=task, is_ai_generated=False, status="MISSING"
    ).delete()

    # 5. Apply the project's similarity threshold uniformly:
    #    - score >= threshold  -> MATCHED
    #    - score <  threshold  -> MISSING  (acts as a second check; even if the
    #      evaluator accepted, the system flags "AI code not semantically good
    #      enough" so the evaluator can reconsider).
    threshold = float(getattr(project, "similarity_threshold", 0.6) or 0.6)
    status = "MATCHED" if similarity >= threshold else "MISSING"

    file_count = submission.files.count()
    code_ref = (
        f"AI submission #{submission.id} (assignment #{assignment.id}, "
        f"attempt {submission.attempt_number}, {file_count} file"
        f"{'s' if file_count != 1 else ''})"
    )

    match = MatchResult.objects.create(
        project=project,
        task=task,
        code_ref=code_ref,
        similarity_score=similarity,
        status=status,
        is_ai_generated=True,
    )

    return {
        "match": match,
        "similarity": similarity,
        "threshold": threshold,
        "below_threshold": similarity < threshold,
    }