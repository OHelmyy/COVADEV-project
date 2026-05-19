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


SYSTEM_PROMPT = """You are a Python developer working INSIDE an existing Django project codebase.

You are given ONE software task to implement. Your code must integrate directly into the existing project — not standalone or generic code.

HARD RULES:
- You ONLY write Python. Never produce other languages.
- Reply with ONE JSON object. No markdown fences, no commentary outside the JSON.
- The JSON shape MUST be exactly:
  {
    "explanation": "<2-4 sentence summary of what you produced, which files you changed/created, and how it connects to the existing code>",
    "files": [
      {
        "filepath": "<full project-relative path, e.g. apps/task_management/services/notify.py>",
        "action": "create",
        "content": "<full Python source>"
      },
      {
        "filepath": "<path to existing file you are updating>",
        "action": "update",
        "content": "<complete updated file — not a diff, the full file>"
      }
    ]
  }
- "files" must contain at least one entry.
- "filepath" must be the full path relative to the project root (e.g. "apps/projects/models.py", NOT just "models.py").
- "action" must be "create" (new file) or "update" (modifying an existing file shown in context).
- For "update" files: provide the COMPLETE updated file content, not just the changed lines.
- Inside "content", escape newlines as \\n.
- Do not include backticks. Do not wrap JSON in ```json ... ```.
- Do NOT add example usage blocks, if __name__ == "__main__" blocks, or print statements.

INTEGRATION RULES (follow strictly):
- Import from the EXACT module paths shown in the project context. Do NOT invent new module paths.
- Use the EXACT model class names, field names, and method names you see in the provided models.py files.
- Follow the same patterns you see in the existing code (class-based views, DRF Response objects, Django ORM, etc.).
- If the task requires adding to an existing file (a new function in a service, a new URL pattern), include that file with action "update".
- Your code must be ready to merge — no placeholder imports, no TODO stubs for integration points.

STYLE GUIDELINES:
- Use type hints on every function parameter and return value.
- Add a concise docstring to every public function and class (one to three lines).
- Use snake_case for functions/variables, PascalCase for classes, UPPER_SNAKE for constants.
- Use f-strings for formatting.
- Use dataclasses for plain data containers.
- Validate inputs early and raise clear exceptions; never use bare except.
- Use pathlib.Path for filesystem paths.
- If the task implies a Django context, use Django ORM patterns (querysets, model methods, transactions).

PROCESS:
The user message includes PROJECT, BPMN PROCESS SUMMARY, PROJECT FILE STRUCTURE, KEY PROJECT FILES, SURROUNDING TASKS, and the TASK.
- PROJECT FILE STRUCTURE lists every file in the project — use these exact paths for imports and filepaths.
- KEY PROJECT FILES shows full content of the most relevant files — use their imports, classes, and functions directly.
- models.py content is always included — use the exact model names and fields you see there.
- BPMN PROCESS SUMMARY tells you the domain; pick abstractions that fit it.
- SURROUNDING TASKS tell you what flows in and out; align your signatures accordingly.
- If the task description is sparse, infer the most plausible behavior from context and state assumptions in "explanation".
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

    parts = [f"PROJECT: {project.name}"]

    project_description = (project.description or "").strip()
    if project_description:
        parts.append(f"PROJECT DESCRIPTION: {project_description}")

    # BPMN summary
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

    # File tree
    try:
        file_tree = _get_project_file_tree(project)
    except Exception:
        file_tree = ""

    if file_tree:
        parts.append("")
        parts.append(
            "PROJECT FILE STRUCTURE (every file in the project — use these exact paths for imports and new file locations):"
        )
        parts.append(file_tree)

    # Full file contents (relevant files + models.py always)
    try:
        full_files = _get_full_file_contents(task, project)
    except Exception:
        full_files = []

    if full_files:
        parts.append("")
        parts.append(
            "KEY PROJECT FILES (read carefully — use these models, imports, and patterns exactly in your code):"
        )
        for filepath, content in full_files:
            parts.append(f"\n--- {filepath} ---")
            parts.append(content)

    # Surrounding tasks
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
            parts.append(f"- Predecessors (run before this task): {', '.join(predecessor_names)}")
        if successor_names:
            parts.append(f"- Successors (run after this task): {', '.join(successor_names)}")

    # Task
    parts.append("")
    parts.append(f"TASK NAME: {task.name or '(unnamed task)'}")
    parts.append(f"TASK DESCRIPTION: {(task.description or '').strip() or '(no description)'}")

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



def _get_project_file_tree(project, max_files: int = 300) -> str:
    """
    Return a sorted list of all indexed file paths in the project.
    Used so the AI knows what modules exist and where to place new files.
    """
    from apps.projects.models import CodeFile

    paths = list(
        CodeFile.objects
        .filter(project=project)
        .values_list("relative_path", flat=True)
        .order_by("relative_path")[:max_files]
    )
    return "\n".join(paths)


def _get_full_file_contents(
    task,
    project,
    max_relevant_files: int = 4,
    max_chars_per_file: int = 3000,
    total_char_budget: int = 14000,
) -> list[tuple[str, str]]:
    """
    Return list of (filepath, content) for the most task-relevant files
    plus all models.py files. Reads actual content from disk.
    """
    import numpy as np
    from pathlib import Path
    from apps.analysis.models import CodeEmbedding, TaskEmbedding
    from apps.task_management.services.ai_match_service import _get_embedder

    active_code = getattr(project, "active_code", None)
    if active_code is None:
        return []

    extracted_dir = (getattr(active_code, "extracted_dir", "") or "").strip()
    if not extracted_dir:
        return []

    extracted_path = Path(extracted_dir)
    if not extracted_path.exists():
        return []

    # 1. Find most relevant file_paths via RAG (best score per file)
    relevant_paths: list[str] = []
    try:
        task_emb = TaskEmbedding.objects.filter(project=project, bpmn_task=task).first()
        if task_emb and task_emb.vector:
            task_vector = task_emb.vector
        else:
            task_text = (task.summary_text or task.description or task.name or "").strip()
            if task_text:
                embedder = _get_embedder()
                task_vector = embedder.embed_many([task_text])[0].vector
            else:
                task_vector = None

        if task_vector is not None:
            tv = np.asarray(task_vector, dtype=float)
            tv_norm = float(np.linalg.norm(tv)) or 1e-9

            code_embs = list(
                CodeEmbedding.objects
                .filter(project=project)
                .select_related("code_artifact")
            )

            file_scores: dict[str, float] = {}
            for ce in code_embs:
                if not ce.vector:
                    continue
                fp = (ce.code_artifact.file_path or "").strip()
                if not fp:
                    continue
                cv = np.asarray(ce.vector, dtype=float)
                cv_norm = float(np.linalg.norm(cv)) or 1e-9
                sim = float(np.dot(tv, cv) / (tv_norm * cv_norm))
                if fp not in file_scores or sim > file_scores[fp]:
                    file_scores[fp] = sim

            relevant_paths = [
                fp for fp, _ in sorted(file_scores.items(), key=lambda x: -x[1])[:max_relevant_files]
            ]
    except Exception:
        pass

    # 2. Always include models.py files
    models_paths: list[str] = []
    try:
        for p in sorted(extracted_path.rglob("models*.py")):
            rel = p.relative_to(extracted_path).as_posix()
            if rel not in relevant_paths:
                models_paths.append(rel)
    except Exception:
        pass

    all_paths = models_paths + [p for p in relevant_paths if p not in models_paths]

    # 3. Read file content from disk
    result: list[tuple[str, str]] = []
    budget = total_char_budget

    for rel_path in all_paths:
        if budget <= 0:
            break
        full_path = extracted_path / rel_path
        if not full_path.exists() or not full_path.is_file():
            continue
        try:
            content = full_path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        content = content.strip()
        if not content:
            continue

        if len(content) > max_chars_per_file:
            content = content[:max_chars_per_file] + "\n... (truncated)"
        if len(content) > budget:
            content = content[:budget] + "\n... (truncated)"

        result.append((rel_path, content))
        budget -= len(content)

    return result

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

        # Support new format (filepath/action) and old format (filename)
        filepath = (
            str(raw_file.get("filepath", "") or raw_file.get("filename", "")).strip()
        )
        if not filepath:
            filepath = f"ai_output_{index + 1}.py"

        # Sanitize each path segment but preserve directory structure
        segments = filepath.replace("\\", "/").split("/")
        clean_segments = [
            re.sub(r"[^A-Za-z0-9_.\-]", "_", seg) for seg in segments if seg
        ]
        filepath = "/".join(clean_segments) if clean_segments else f"ai_output_{index + 1}.py"

        # Ensure .py extension
        if not filepath.endswith(".py"):
            base = filepath.rsplit(".", 1)[0] if "." in filepath.split("/")[-1] else filepath
            filepath = base + ".py"

        filepath = filepath[:500]  # safety cap

        content = str(raw_file.get("content", ""))
        if not content.strip():
            continue

        AIGeneratedFile.objects.create(
            submission=submission,
            filename=filepath,
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
