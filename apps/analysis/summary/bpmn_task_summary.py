from __future__ import annotations

from typing import Optional, List
from .shared_model_singleton import ModelProvider




def summarize_bpmn_task_text(prompt: str) -> str:
    provider = ModelProvider()
    try:
        response = provider.client.chat.completions.create(
            model=provider.model_name,
            messages=[
                {"role": "system", "content": "You are a precise business analyst."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=100,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Groq API call failed: {e}")
        return ""

def build_bpmn_task_summary_input(
    name,
    description,
    task_type=None,
    incoming=None,
    outgoing=None,
):
    desc = (description or "").strip()
    ttype = (task_type or "").strip()
    comes_after = ", ".join(incoming or []) or "None"
    leads_to = ", ".join(outgoing or []) or "None"

    return (
        "Write exactly 1 clear sentence describing this BPMN task.\n\n"
        "Rules:\n"
        "- Start with a verb (Searches, Adds, Applies, Confirms, Charges, Sends, Validates, Retrieves)\n"
        "- Mention the main business object (book, cart, order, payment, email, inventory)\n"
        "- Describe what is checked, updated, sent, or confirmed\n"
        "- Do NOT mention the actor (no 'Customer', 'System', 'User')\n"
        "- Do NOT mention implementation details\n"
        "- Do NOT start with 'This task', 'The task', 'Task:'\n"
        "- Exactly 2 sentences, each under 15 words, each ending with a period\n\n"
        f"Task name: {name or 'Unknown'}\n"
        f"Task description: {desc if desc else 'Missing'}\n"
        f"Comes after: {comes_after}\n"
        f"Leads to: {leads_to}"
    )


def is_bad_bpmn_summary(summary: str, name: str) -> bool:
    s = (summary or "").strip().lower()
    n = (name or "").strip().lower()

    if not s:
        return True

    bad_phrases = [
        "not defined in the given bpmn diagram",
        "not defined in the bpmn diagram",
        "please provide more context",
        "please provide more details",
        "not enough context",
        "insufficient context",
        "cannot determine",
        "cannot infer",
        "unknown",
    ]

    if any(p in s for p in bad_phrases):
        return True

    if s == n or s == f"{n}.":
        return True

    return False


def build_bpmn_task_repair_input(name, description, bad_output):
    return (
        "Rewrite this BPMN task summary as exactly 2 short, concise sentences.\n\n"
        "Rules:\n"
        "- Start with a verb (Searches, Adds, Applies, Confirms, Charges, Sends, Validates, Retrieves)\n"
        "- Mention the main business object (book, cart, order, payment, email, inventory)\n"
        "- Do NOT say the task is undefined, unknown, or missing context\n"
        "- Do NOT ask for more details or explain limitations\n"
        "- Do NOT mention the actor (no 'Customer', 'System', 'User')\n"
        "- Exactly 1 sentence, under 20 words, ending with a period\n"
        "- Use 'and' to connect two actions if needed\n\n"
        f"Task name: {name or 'Unknown'}\n"
        f"Task description: {description or 'Not provided'}\n"
        f"Bad summary to fix: {bad_output or ''}"
    )


def summarize_bpmn_task(
    name: Optional[str],
    description: Optional[str],
    task_type: Optional[str] = None,
    incoming: Optional[List[str]] = None,
    outgoing: Optional[List[str]] = None,
) -> str:
    print(f"🔥 BPMN summarize called for: {name}")
    prompt = build_bpmn_task_summary_input(name, description, task_type, incoming, outgoing)
    summary = summarize_bpmn_task_text(prompt)
    summary = clean_summary(summary)
    summary = " ".join((summary or "").splitlines()).strip()

    if is_bad_bpmn_summary(summary, name or ""):
        repair_prompt = build_bpmn_task_repair_input(name, description, summary)
        summary = summarize_bpmn_task_text(repair_prompt)
        summary = clean_summary(summary)
        summary = " ".join((summary or "").splitlines()).strip()

    return summary


def clean_summary(text: str) -> str:
    if not text:
        return text

    prefixes = [
        "the bpmn task",
        "this task",
        "the task",
        "task:",
        "task :",
    ]

    t = text.strip()

    for p in prefixes:
        if t.lower().startswith(p):
            t = t[len(p):].strip()

    if t.lower().startswith("is "):
        t = t[3:].strip()

    return t[:1].upper() + t[1:] if t else t