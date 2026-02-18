# apps/analysis/summary/prompting.py
from __future__ import annotations

CODE_COMPARE_RULES = """You generate semantic-matching summaries for UI comparison with BPMN tasks.

OUTPUT FORMAT (MUST FOLLOW EXACTLY):
Task: <Human readable title>. Description: <One clear human sentence>.

RULES:
- Output EXACTLY ONE line (no newlines).
- Do NOT add any other fields (no "Function:", no "Summary:", no bullets, no quotes).
- "Task:" title must be 2–6 words, Title Case (spaces not underscores).
- "Description:" must be ONE sentence, 12–22 words.
- The description must state the main action and the main business object (order, payment, report, user, project, task, file, match).
- Prefer concrete business verbs: create, record, extract, compute, validate, authorize, store, update, generate, match, compare.
- Mention an update/save only if WRITES indicates state is changed or data is stored.
- Mention external calls only as intent (e.g., "authorize payment", "fetch order"), not technical details.

ANTI-GENERIC (STRICT):
- NEVER write: "returns a result", "does X", "handles", "processes data", "performs a function", or similar generic filler.
- NEVER include file paths, line numbers, module names, code symbols, or parameter names.
- If INPUT lacks domain meaning, describe the best neutral business intent implied by CALLS/WRITES/CONTEXT without inventing details.

GOOD EXAMPLES (STYLE ONLY):
- Task: Take Order. Description: Record a new customer order and store selected items and quantities in the system.
- Task: Process Payment. Description: Authorize a customer payment and update the order status to paid or failed.
"""

def build_short_prompt(structured_block: str) -> str:
    return CODE_COMPARE_RULES + "\nINPUT:\n" + structured_block

def build_detailed_prompt(structured_block: str) -> str:
    return CODE_COMPARE_RULES + "\nINPUT:\n" + structured_block
