# apps/analysis/summary/bpmn_time_estimation_service.py

from __future__ import annotations

import json
import re
from typing import Optional, List, Dict, Any

from apps.analysis.summary.shared_model_singleton import ModelProvider


DEFAULT_ESTIMATES_BY_TYPE = {
    "task": 35,
    "userTask": 40,
    "manualTask": 35,
    "serviceTask": 45,
    "scriptTask": 50,
    "businessRuleTask": 60,
    "sendTask": 20,
    "receiveTask": 20,
    "callActivity": 120,
}


SIMPLE_KEYWORDS = {
    "send": 15,
    "notify": 15,
    "email": 15,
    "receipt": 15,
    "serve": 15,
    "display": 15,
    "show": 15,
    "message": 15,
    "confirm": 25,
    "take": 25,
    "capture": 30,
    "prepare": 30,
    "pack": 35,
    "pick": 35,
    "print": 25,
}


MODERATE_KEYWORDS = {
    "place": 35,
    "create": 40,
    "update": 45,
    "reserve": 45,
    "calculate": 60,
    "pricing": 60,
    "discount": 70,
    "coupon": 70,
    "inventory": 60,
    "availability": 50,
    "quality": 45,
    "retry": 45,
    "correction": 45,
}

COMPLEX_KEYWORDS = {
    "validate": 360,
    "verify": 300,
    "process payment": 480,
    "payment": 420,
    "authorize": 480,
    "fraud": 960,
    "risk": 900,
    "manual review": 360,
    "report": 720,
    "daily report": 900,
    "operations report": 1200,
    "analytics": 1200,
    "integration": 960,
    "external": 960,
    "courier": 480,
    "delivery delay": 600,
    "escalate": 360,
    "workflow": 1200,
    "orchestration": 1800,
}


def _normalize_text(*parts: Optional[str]) -> str:
    text = " ".join([p or "" for p in parts])
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _contains_phrase(text: str, phrase: str) -> bool:
    return phrase in text


def keyword_based_estimate(
    *,
    name: Optional[str],
    description: Optional[str],
    summary: Optional[str],
    task_type: Optional[str],
    incoming: Optional[List[str]] = None,
    outgoing: Optional[List[str]] = None,
) -> Dict[str, Any]:
    text = _normalize_text(name, description, summary)
    normalized_type = (task_type or "task").strip() or "task"

    base = DEFAULT_ESTIMATES_BY_TYPE.get(normalized_type, 35)
    matched_reasons: List[str] = []

    has_complex_match = False

    for keyword, minutes in COMPLEX_KEYWORDS.items():
        if _contains_phrase(text, keyword):
            base = max(base, minutes)
            has_complex_match = True
            matched_reasons.append(f"contains complex keyword '{keyword}'")

    for keyword, minutes in MODERATE_KEYWORDS.items():
        if _contains_phrase(text, keyword):
            base = max(base, minutes)
            matched_reasons.append(f"contains moderate keyword '{keyword}'")

    for keyword, minutes in SIMPLE_KEYWORDS.items():
        if _contains_phrase(text, keyword):
            if not has_complex_match and base <= 45:
                base = max(base, minutes)
            matched_reasons.append(f"contains simple keyword '{keyword}'")

    incoming_count = len(incoming or [])
    outgoing_count = len(outgoing or [])

    if incoming_count + outgoing_count >= 4:
        base += 20
        matched_reasons.append("has several incoming/outgoing workflow connections")

    if outgoing_count >= 2:
        base += 15
        matched_reasons.append("has multiple possible next steps")

    if incoming_count >= 2:
        base += 10
        matched_reasons.append("can be reached from multiple previous paths")

    # Keep realistic bounds for one BPMN task implementation.
    base = max(30, min(base, 2400))

    if base <= 20:
        complexity = "VERY_SIMPLE"
    elif base <= 45:
        complexity = "SIMPLE"
    elif base <= 90:
        complexity = "MODERATE"
    elif base <= 180:
        complexity = "COMPLEX"
    else:
        complexity = "VERY_COMPLEX"

    if matched_reasons:
        reason = (
            f"{complexity}: Estimated from task type '{normalized_type}', task name, "
            f"description, and workflow context; {', '.join(matched_reasons[:4])}."
        )
    else:
        reason = (
            f"{complexity}: Estimated from BPMN task type '{normalized_type}' "
            "and workflow context."
        )

    return {
        "minutes": base,
        "source": "FALLBACK",
        "complexity": complexity,
        "reason": reason[:1000],
    }


def build_bpmn_time_estimation_prompt(
    *,
    name: Optional[str],
    description: Optional[str],
    summary: Optional[str],
    task_type: Optional[str],
    incoming: Optional[List[str]],
    outgoing: Optional[List[str]],
    heuristic_minutes: int,
) -> str:
    return f"""
You are estimating REALISTIC software development effort for one BPMN task.

Return ONLY valid JSON in this exact format:
{{
  "minutes": 480,
  "complexity": "MODERATE",
  "reason": "Short realistic reason here."
}}

IMPORTANT:
- Estimate how long ONE developer needs to implement this BPMN task in software.
- This is REALISTIC development effort, not business waiting time.
- 1 working day = 8 hours = 480 minutes.
- Include implementation, validation, database/API changes if needed, UI changes if needed, and basic testing.

STRICT ESTIMATION SCALE:
- VERY_SIMPLE: 30-120 minutes
  Examples: send notification, send receipt, simple status update.

- SIMPLE: 120-240 minutes
  Examples: take order, capture form input, create simple record, send confirmation.

- MODERATE: 240-480 minutes
  Examples: process payment, update inventory, calculate pricing, apply discount, validate customer data.

- COMPLEX: 480-960 minutes
  Examples: fraud/risk assessment, report generation, multi-branch rules, external provider integration, delivery delay handling.

- VERY_COMPLEX: 960-2400 minutes
  Examples: full workflow orchestration, multiple integrations, advanced analytics, complex reporting with several data sources.

STRICT RULES:
- Use minutes only in the JSON.
- Minimum allowed value: 30 minutes.
- Maximum allowed value: 2400 minutes.
- Do NOT give the same estimate for all tasks.
- Do NOT use 120 minutes or 1 day as a default.
- Simple communication tasks should usually be less than half a day.
- Payment, validation, inventory, pricing, and discount tasks should usually be half a day to one day.
- Reports, fraud checks, integrations, exception handling, and multi-branch tasks can take one or more days.
- If the task has many incoming/outgoing paths, increase the estimate.
- If the task is part of a loop, retry path, rejection path, or exception flow, increase the estimate.
- Give a specific reason based on this exact task.
- Do not include markdown.
- Do not include extra text.

Heuristic estimate: {heuristic_minutes} minutes.

BPMN task data:
Task name: {name or "Unknown"}
Task type: {task_type or "task"}
Task description: {description or "Missing"}
Task summary: {summary or "Missing"}
Comes after: {", ".join(incoming or []) or "None"}
Leads to: {", ".join(outgoing or []) or "None"}
""".strip()


def estimate_bpmn_task_time(
    *,
    name: Optional[str],
    description: Optional[str],
    summary: Optional[str],
    task_type: Optional[str],
    incoming: Optional[List[str]] = None,
    outgoing: Optional[List[str]] = None,
) -> Dict[str, Any]:
    heuristic = keyword_based_estimate(
        name=name,
        description=description,
        summary=summary,
        task_type=task_type,
        incoming=incoming,
        outgoing=outgoing,
    )

    heuristic_minutes = int(heuristic["minutes"])

    try:
        provider = ModelProvider()

        prompt = build_bpmn_time_estimation_prompt(
            name=name,
            description=description,
            summary=summary,
            task_type=task_type,
            incoming=incoming,
            outgoing=outgoing,
            heuristic_minutes=heuristic_minutes,
        )

        response = provider.client.chat.completions.create(
            model=provider.model_name,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You estimate software development effort for BPMN tasks. "
                        "Return JSON only. Be realistic. Do not assign the same duration "
                        "to every task."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.1,
            max_tokens=180,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content.strip()
        data = json.loads(raw)

        ai_minutes = int(data.get("minutes") or heuristic_minutes)
        ai_minutes = max(30, min(ai_minutes, 2400)) 

        complexity = str(data.get("complexity") or "").strip().upper()
        reason = str(data.get("reason") or "").strip()

        if not reason:
            reason = heuristic["reason"]

        # Protection against generic repeated estimates.
        # If the AI returns 120 minutes for a clearly simple task, use heuristic instead.
        if ai_minutes == 120 and heuristic_minutes <= 45:
            final_minutes = heuristic_minutes
            source = "FALLBACK"
            final_reason = heuristic["reason"]

        # If the AI is extremely far from the heuristic, trust the heuristic more.
        # This prevents unrealistic jumps like 15 min -> 300 min or 180 min -> 20 min.
        elif abs(ai_minutes - heuristic_minutes) > 720:
            final_minutes = heuristic_minutes
            source = "FALLBACK"
            final_reason = heuristic["reason"]

        else:
            final_minutes = ai_minutes
            source = "AI"
            final_reason = reason

            if complexity:
                final_reason = f"{complexity}: {final_reason}"

        return {
            "minutes": final_minutes,
            "source": source,
            "reason": final_reason[:1000],
        }

    except Exception:
        return {
            "minutes": heuristic_minutes,
            "source": "FALLBACK",
            "reason": heuristic["reason"][:1000],
        }