from __future__ import annotations

import json
import os
import re
import time
from typing import Optional

from django.utils import timezone

from apps.analysis.models import BpmnTask
from apps.analysis.summary.shared_model_singleton import ModelProvider
from apps.task_management.models import (
    TaskAssignment,
    AISubmission,
    AIGeneratedFile,
    AIExecutionLog,
)


EXECUTOR_MODEL_NAME = os.environ.get(
    "AI_EXECUTOR_MODEL",
    "llama-3.3-70b-versatile",
)


SYSTEM_PROMPT = """You are an autonomous Python developer agent.

You are given ONE software task. You must produce the Python code that implements it.

HARD RULES (must follow exactly):
- You ONLY write Python. Never produce other languages.
- Reply with ONE JSON object. No markdown fences, no commentary outside the JSON.
- The JSON shape MUST be exactly:
  {
    "explanation": "<2-4 sentence summary of what you produced and any assumptions>",
    "files": [
      {"filename": "<snake_case_name>.py", "language": "python", "content": "<full Python source>"}
    ]
  }
- "files" must contain at least one entry. All filenames must end with ".py".
- Inside "content", use real newlines in the JSON string (escape them as \\n).
- Do not include backticks. Do not wrap the JSON in ```json ... ```.
- Produce importable library code ONLY. Do NOT include:
  * "# Example usage:" blocks or similar demonstration sections.
  * Sample object instantiations or fake data values at module scope.
  * `if __name__ == "__main__":` blocks.
  * `print(...)` calls that show how to use the function.
  The module must contain only the requested functions/classes and their imports.
- If the task is impossible or non-Python, still produce a Python module that documents why
  (one file with a clear docstring explaining the limitation).

STYLE GUIDELINES (follow unless the task explicitly says otherwise):
- Use type hints on every function parameter and return value.
- Add a concise docstring to every public function and class (one to three lines).
- Use snake_case for functions and variables, PascalCase for classes, UPPER_SNAKE for constants.
- Prefer small, single-purpose functions over long ones.
- Use f-strings for string formatting; do not use % or .format() unless required.
- Use dataclasses (with @dataclass) for plain data containers instead of tuples or dicts.
- Validate inputs early and raise clear exceptions; never use bare except.
- Do not print debug output; do not depend on global mutable state.
- Use pathlib.Path for filesystem paths instead of string joins.
- If the task implies a Django context, use Django ORM patterns (querysets, model methods,
  transactions, signals) rather than raw SQL.

PROCESS HINTS (read the user message carefully before writing code).
The user message may include PROJECT, PROJECT DESCRIPTION, BPMN PROCESS SUMMARY,
SURROUNDING TASKS, EXISTING RELATED CODE, and the TASK itself.
- The PROJECT and BPMN context tell you the domain; pick names and abstractions that fit it.
- If EXISTING RELATED CODE is present, treat it as your project's actual codebase: reuse class
  names, function names, and parameter conventions from those snippets. Do not invent parallel
  abstractions if a similar one already exists. Import or call the existing classes/functions
  explicitly when appropriate.
- The SURROUNDING TASKS tell you what objects flow in from predecessors and out to successors.
  Make your function signatures align with that data flow.
- If the task description is sparse, infer the most plausible behavior from the BPMN context
  and state your assumptions in the "explanation" field.
"""


MAX_TRANSIENT_RETRIES = 1
TRANSIENT_BACKOFF_SECONDS = 2.0
_TRANSIENT_EXCEPTION_NAMES = {
    "APITimeoutError",
    "APIConnectionError",
    "RateLimitError",
    "InternalServerError",
    "ServiceUnavailableError",
}

_TRANSIENT_MESSAGE_PATTERNS = (
    "timeout", "timed out", "rate limit", "ratelimit",
    " 429", " 502", " 503", " 504",
    "temporarily unavailable",
)


class AIExecutorError(Exception):
    """Base class for any AI executor failure."""
    user_message: str = "AI execution failed."


class AITransientError(AIExecutorError):
    """The provider failed in a way that is likely temporary."""
    user_message = (
        "The AI provider was temporarily unavailable "
        "(timeout / rate limit / brief outage). "
        "Try Send Back to AI again in a moment."
    )


class AIPermanentError(AIExecutorError):
    """The provider returned something we cannot use; retrying will not help."""
    user_message = (
        "The AI did not produce a usable result. "
        "Please reassign this task to a human developer."
    )


def _is_transient_error(exc: Exception) -> bool:
    if exc.__class__.__name__ in _TRANSIENT_EXCEPTION_NAMES:
        return True
    msg = str(exc).lower()
    return any(p in msg for p in _TRANSIENT_MESSAGE_PATTERNS)


def _build_user_prompt(
    assignment: TaskAssignment,
    previous_attempt: Optional[AISubmission],
    review_feedback: str,
) -> str:
    task = assignment.bpmn_task
    project = assignment.project

    parts = [
        f"PROJECT: {project.name}",
    ]

    project_description = (project.description or "").strip()
    if project_description:
        parts.append(f"PROJECT DESCRIPTION: {project_description}")

    # --- Improvement 2: BPMN summary -------------------------------------
    bpmn_summary = ""
    active_bpmn = getattr(project, "active_bpmn", None)
    if active_bpmn is not None:
        bpmn_summary = (getattr(active_bpmn, "bpmn_summary", "") or "").strip()

    if bpmn_summary:
        if len(bpmn_summary) > 1500:
            bpmn_summary = bpmn_summary[:1500] + "\n... (truncated)"
        parts.append("")
        parts.append("BPMN PROCESS SUMMARY:")
        parts.append(bpmn_summary)

    # --- Improvement 3: sibling tasks (BPMN flow context) ----------------
    incoming_ids = list(task.incoming_nodes or [])
    outgoing_ids = list(task.outgoing_nodes or [])

    predecessor_names: list[str] = []
    successor_names: list[str] = []

    if incoming_ids:
        predecessor_names = list(
            BpmnTask.objects
            .filter(project=project, task_id__in=incoming_ids)
            .exclude(id=task.id)
            .values_list("name", flat=True)
        )

    if outgoing_ids:
        successor_names = list(
            BpmnTask.objects
            .filter(project=project, task_id__in=outgoing_ids)
            .exclude(id=task.id)
            .values_list("name", flat=True)
        )

    if predecessor_names or successor_names:
        parts.append("")
        parts.append("SURROUNDING TASKS (BPMN flow context):")
        if predecessor_names:
            parts.append(
                f"- Predecessors (run before this task): {', '.join(predecessor_names)}"
            )
        if successor_names:
            parts.append(
                f"- Successors (run after this task): {', '.join(successor_names)}"
            )

    # --- Improvement 5 (RAG): top-K related existing code snippets -------
    try:
        related = _get_related_code(task, project, k=8)
    except Exception:
        related = []

    if related:
        parts.append("")
        parts.append(
            "EXISTING RELATED CODE (most similar functions/classes already in the project; "
            "reuse names and patterns where appropriate):"
        )
        for sim, artifact, snippet in related:
            location = artifact.file_path or "(unknown file)"
            symbol = artifact.symbol or "(unnamed)"
            parts.append(f"--- {location} :: {symbol} (similarity {sim:.2f}) ---")
            parts.append(snippet)

    # --- TASK NAME / DESCRIPTION ------------------------------------------
    parts.append("")
    parts.append(f"TASK NAME: {task.name or '(unnamed task)'}")
    parts.append(
        f"TASK DESCRIPTION: {(task.description or '').strip() or '(no description)'}"
    )

    if previous_attempt is not None:
        parts.append("")
        parts.append("PREVIOUS ATTEMPT EXPLANATION:")
        parts.append(previous_attempt.explanation or "(none)")

        prev_files = list(previous_attempt.files.all())
        if prev_files:
            parts.append("")
            parts.append("PREVIOUS ATTEMPT FILES:")
            for f in prev_files:
                parts.append(f"--- {f.filename} ---")
                parts.append(f.content)

        if review_feedback:
            parts.append("")
            parts.append("EVALUATOR FEEDBACK ON PREVIOUS ATTEMPT:")
            parts.append(review_feedback)
            parts.append("")
            parts.append("Produce a NEW improved version that addresses this feedback.")

    return "\n".join(parts)


def _get_related_code(
    task,
    project,
    k: int = 8,
    max_chars_per_snippet: int = 800,
    total_char_budget: int = 6000,
):
    """
    Return up to k existing code snippets from the project that are most
    semantically similar to the assigned task. Each entry is
    (similarity, CodeArtifact, truncated_snippet).
    Reuses the existing TaskEmbedding/CodeEmbedding infrastructure;
    falls back to computing the task vector on the fly if missing.
    Returns [] if no embeddings or no relevant code exists.
    """
    import numpy as np
    from apps.analysis.models import TaskEmbedding, CodeEmbedding
    from apps.task_management.services.ai_match_service import _get_embedder

    # 1. Task vector
    task_emb = TaskEmbedding.objects.filter(project=project, bpmn_task=task).first()
    if task_emb is not None and task_emb.vector:
        task_vector = task_emb.vector
    else:
        task_text = (task.summary_text or task.description or task.name or "").strip()
        if not task_text:
            return []
        try:
            embedder = _get_embedder()
            task_vector = embedder.embed_many([task_text])[0].vector
        except Exception:
            return []

    # 2. All code embeddings for this project
    code_embs = list(
        CodeEmbedding.objects
        .filter(project=project)
        .select_related("code_artifact")
    )
    if not code_embs:
        return []

    # 3. Cosine similarity
    tv = np.asarray(task_vector, dtype=float)
    tv_norm = float(np.linalg.norm(tv)) or 1e-9

    scored = []
    for ce in code_embs:
        if not ce.vector:
            continue
        cv = np.asarray(ce.vector, dtype=float)
        cv_norm = float(np.linalg.norm(cv)) or 1e-9
        sim = float(np.dot(tv, cv) / (tv_norm * cv_norm))
        scored.append((sim, ce.code_artifact))

    if not scored:
        return []

    # 4. Top K
    scored.sort(key=lambda x: -x[0])
    top = scored[:k]

    # 5. Truncate snippets within total budget
    result = []
    budget = total_char_budget
    for sim, artifact in top:
        if budget <= 0:
            break
        snippet = (artifact.raw_snippet or "").strip()
        if not snippet:
            continue
        if len(snippet) > max_chars_per_snippet:
            snippet = snippet[:max_chars_per_snippet] + "\n... (truncated)"
        if len(snippet) > budget:
            snippet = snippet[:budget] + "\n... (truncated)"
        result.append((sim, artifact, snippet))
        budget -= len(snippet)

    return result


def _extract_json(raw: str) -> Optional[dict]:
    if not raw:
        return None
    raw = raw.strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:
        return None


def _safe_filename(name: str, fallback: str) -> str:
    name = (name or "").strip()
    if not name:
        return fallback
    # Keep letters, digits, underscore, dot, hyphen
    cleaned = re.sub(r"[^A-Za-z0-9_.\-]", "_", name)
    if not cleaned.endswith(".py"):
        cleaned = cleaned.rsplit(".", 1)[0] + ".py" if "." in cleaned else cleaned + ".py"
    return cleaned[:255]


def execute_ai_assignment(assignment_id: int) -> AISubmission:
    """
    Calls the LLM to generate Python files for the given AI-assigned task,
    saves them as an AISubmission, logs the call, and marks the assignment
    as SUBMITTED. Raises an Exception if anything fails fatally; the caller
    is responsible for handling fallback (e.g., setting status to REJECTED).
    """
    assignment = (
        TaskAssignment.objects
        .select_related(
            "bpmn_task",
            "developer_membership",
            "project",
        )
        .get(id=assignment_id)
    )

    # Defensive: only run for AI-agent memberships
    if not assignment.developer_membership.is_ai_agent:
        raise ValueError(
            f"Assignment {assignment_id} is not assigned to the AI agent."
        )

    task = assignment.bpmn_task
    attempt_number = assignment.ai_submissions.count() + 1
    previous = assignment.ai_submissions.order_by("-created_at").first()
    review_feedback = (assignment.review_notes or "").strip()

    user_prompt = _build_user_prompt(
        assignment=assignment,
        previous_attempt=previous,
        review_feedback=review_feedback,
    )

    provider = ModelProvider()
    client = provider.client

    started_at = time.time()
    raw_response = ""
    tokens_used = 0
    attempts = 0
    last_exc: Exception | None = None

    while attempts <= MAX_TRANSIENT_RETRIES:
        attempts += 1
        try:
            response = client.chat.completions.create(
                model=EXECUTOR_MODEL_NAME,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=4000,
                response_format={"type": "json_object"},
            )
            raw_response = response.choices[0].message.content or ""
            usage = getattr(response, "usage", None)
            tokens_used = getattr(usage, "total_tokens", 0) or 0
            last_exc = None
            break
        except Exception as e:
            last_exc = e
            if _is_transient_error(e) and attempts <= MAX_TRANSIENT_RETRIES:
                time.sleep(TRANSIENT_BACKOFF_SECONDS)
                continue
            break

    if last_exc is not None:
        latency_ms = int((time.time() - started_at) * 1000)
        log_error = f"LLM call failed after {attempts} attempt(s): {last_exc}"
        AIExecutionLog.objects.create(
            assignment=assignment,
            prompt=user_prompt,
            response="",
            model=EXECUTOR_MODEL_NAME,
            tokens=0,
            latency_ms=latency_ms,
            status="FAILED",
            error_message=log_error,
        )
        if _is_transient_error(last_exc):
            raise AITransientError(str(last_exc)) from last_exc
        raise AIPermanentError(str(last_exc)) from last_exc

    latency_ms = int((time.time() - started_at) * 1000)
    data = _extract_json(raw_response)

    if not data or "files" not in data or not isinstance(data["files"], list) or not data["files"]:
        log_error = "Could not parse a valid JSON object with non-empty files."
        AIExecutionLog.objects.create(
            assignment=assignment,
            prompt=user_prompt,
            response=raw_response,
            model=EXECUTOR_MODEL_NAME,
            tokens=tokens_used,
            latency_ms=latency_ms,
            status="FAILED",
            error_message=log_error,
        )
        raise AIPermanentError(log_error)

    explanation = str(data.get("explanation", "")).strip()[:5000]

    submission = AISubmission.objects.create(
        assignment=assignment,
        explanation=explanation,
        model_used=EXECUTOR_MODEL_NAME,
        tokens_used=tokens_used,
        attempt_number=attempt_number,
    )

    created_files = 0
    for index, raw_file in enumerate(data["files"]):
        if not isinstance(raw_file, dict):
            continue
        filename = _safe_filename(
            str(raw_file.get("filename", "")),
            fallback=f"ai_output_{index + 1}.py",
        )
        content = str(raw_file.get("content", ""))
        if not content.strip():
            continue
        AIGeneratedFile.objects.create(
            submission=submission,
            filename=filename,
            language="python",
            content=content,
        )
        created_files += 1

    if created_files == 0:
        log_error = "No usable files in LLM response."
        AIExecutionLog.objects.create(
            assignment=assignment,
            prompt=user_prompt,
            response=raw_response,
            model=EXECUTOR_MODEL_NAME,
            tokens=tokens_used,
            latency_ms=latency_ms,
            status="FAILED",
            error_message=log_error,
        )
        submission.delete()
        raise AIPermanentError(log_error)

    AIExecutionLog.objects.create(
        assignment=assignment,
        prompt=user_prompt,
        response=raw_response,
        model=EXECUTOR_MODEL_NAME,
        tokens=tokens_used,
        latency_ms=latency_ms,
        status="SUCCESS",
    )

    assignment.status = TaskAssignment.Status.SUBMITTED
    assignment.submission_notes = explanation
    assignment.submitted_at = timezone.now()
    assignment.save(update_fields=[
        "status", "submission_notes", "submitted_at", "updated_at",
    ])

    return submission
