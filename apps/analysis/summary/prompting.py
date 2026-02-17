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
- The description must state the main action and the main business object.
- Do NOT invent details not present in INPUT.
"""

def build_short_prompt(structured_block: str) -> str:
    return CODE_COMPARE_RULES + "\nINPUT:\n" + structured_block

def build_detailed_prompt(structured_block: str) -> str:
    return CODE_COMPARE_RULES + "\nINPUT:\n" + structured_block
