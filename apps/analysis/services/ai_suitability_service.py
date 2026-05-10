from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Optional

from apps.analysis.models import BpmnTask
from apps.analysis.summary.shared_model_singleton import ModelProvider

import os

CLASSIFIER_MODEL_NAME = os.environ.get(
    "AI_SUITABILITY_MODEL",
    "llama-3.3-70b-versatile",
)

VALID_LABELS = {"RECOMMENDED", "NEUTRAL", "NOT_RECOMMENDED"}


SYSTEM_PROMPT = """You evaluate whether a software development task is suitable for an AI agent to complete autonomously.

Constraints of the AI agent:
- It can ONLY write Python code.
- It cannot do UI/UX design, database migrations on production data, infrastructure work, or anything requiring live debugging or stakeholder input.

Labels:
- RECOMMENDED: clear, bounded, specification-heavy Python coding tasks (CRUD, validation, unit tests, simple business logic, scaffolding, refactors with clear rules).
- NOT_RECOMMENDED: architecture decisions, security-sensitive code, performance tuning, anything requiring wide cross-file context, anything not Python.
- NEUTRAL: a task that could go either way.

You must reply with ONLY one JSON object on a single line, exactly in this shape:
{"label": "RECOMMENDED" | "NEUTRAL" | "NOT_RECOMMENDED", "reason": "<one short sentence>"}
No markdown, no code fences, no explanation outside the JSON.
"""


def _build_user_prompt(task: BpmnTask) -> str:
    name = (task.name or "").strip() or "(no name)"
    description = (task.description or "").strip() or "(no description)"
    return f"TASK NAME: {name}\nTASK DESCRIPTION: {description}"


def _extract_json(raw: str) -> Optional[dict]:
    if not raw:
        return None
    raw = raw.strip()
    # Try direct parse first.
    try:
        return json.loads(raw)
    except Exception:
        pass
    # Fallback: find the first {...} block in the text.
    match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:
        return None


def classify_bpmn_task(task: BpmnTask) -> BpmnTask:
    """
    Calls the LLM to classify one BpmnTask for AI suitability and saves the result.
    On any failure, leaves the task as UNKNOWN.
    """
    provider = ModelProvider()
    client = provider.client
    model_name = CLASSIFIER_MODEL_NAME

    label = "UNKNOWN"
    reason = ""

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(task)},
            ],
            temperature=0.0,
            max_tokens=120,
        )
        raw = response.choices[0].message.content or ""
        data = _extract_json(raw)

        if data:
            candidate_label = str(data.get("label", "")).strip().upper()
            candidate_reason = str(data.get("reason", "")).strip()

            if candidate_label in VALID_LABELS:
                label = candidate_label
                reason = candidate_reason[:500]  # safety cap
    except Exception as e:
        print(f"[ai_suitability] LLM call failed for task {task.id}: {e}")

    task.ai_suitability = label
    task.ai_suitability_reason = reason
    task.ai_suitability_checked_at = datetime.now(timezone.utc)
    task.save(update_fields=[
        "ai_suitability",
        "ai_suitability_reason",
        "ai_suitability_checked_at",
    ])
    return task


def classify_unclassified_tasks_for_project(project_id: int) -> int:
    """
    Classifies every BpmnTask in a project that is still UNKNOWN.
    Returns the number of tasks classified.
    """
    qs = BpmnTask.objects.filter(project_id=project_id, ai_suitability="UNKNOWN")
    count = 0
    for task in qs:
        classify_bpmn_task(task)
        count += 1
    return count  