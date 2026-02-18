# apps/analysis/summary/service.py
from __future__ import annotations

from typing import Dict, List

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM


from .generator import build_generator_block
from .postprocess import validate_one_sentence, validate_detailed
from .postprocess import validate_code_compare_line


# ✅ NEW: BPMN-like output format for Code Function cards (Compare tab)
CODE_COMPARE_RULES = """You generate semantic-matching summaries for UI comparison with BPMN tasks.

OUTPUT FORMAT (MUST FOLLOW EXACTLY):
Task: <Human readable title>. Description: <One clear human sentence>.

RULES:
- Output EXACTLY ONE line (no newlines).
- Do NOT add any other fields (no "Function:", no "Summary:").
- Title must be 2–6 words, Title Case, spaces not underscores.
- Description must be ONE sentence, 12–22 words.
- Mention the main action and the main business object.
- Do NOT invent details not present in the input.
"""

# ✅ Keep your existing behavior for detailed UI/debug summary
DETAILED_RULES = """You explain code behavior clearly for humans.
Task: Write 2 to 4 short sentences explaining what the function does and how it does it.
Rules:
- Easy, human-friendly language.
- Mention key actions (e.g., reads, validates, updates, saves, calls).
- Mention important inputs/outputs if present.
- Do NOT invent details not in the input.
- Output plain text only (no bullets, no quotes).
"""


def build_code_compare_prompt(structured_block: str) -> str:
    return CODE_COMPARE_RULES + "\nINPUT:\n" + structured_block


def build_detailed_prompt(structured_block: str) -> str:
    return DETAILED_RULES + "\nINPUT:\n" + structured_block


class SummaryService:
    """
    Local FLAN-T5 summarizer:
    - short_summary: BPMN-like single-line ("Task: ... Description: ...") for Compare tab + embeddings
    - detailed_summary: 2–4 sentences for UI/debug
    """

    def __init__(self, model_name: str = "google/flan-t5-base") -> None:
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(self.device)
        self.model.eval()

    def summarize_many(self, structured_functions: List[Dict]) -> Dict[str, Dict[str, str]]:
        out: Dict[str, Dict[str, str]] = {}

        for sf in structured_functions:
            uid = (sf.get("function_uid") or "").strip()
            if not uid:
                continue

            block = build_generator_block(sf)

            # ✅ short = BPMN-like format for Compare cards
            short_prompt = build_code_compare_prompt(block)
            detailed_prompt = build_detailed_prompt(block)

            short_raw = self._call_model(short_prompt, max_new_tokens=60)
            detailed_raw = self._call_model(detailed_prompt, max_new_tokens=160)

            # ✅ Validate output
            # - short must be ONE sentence (we also enforce one line below)

            short_clean = validate_code_compare_line(short_raw)
            short_clean = " ".join((short_clean or "").splitlines()).strip()  # force single-line

            out[uid] = {
                "short": short_clean,
                "detailed": validate_detailed(detailed_raw),
            }

        return out

    def _call_model(self, prompt: str, max_new_tokens: int) -> str:
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512,
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=int(max_new_tokens),  # ✅ correct
                num_beams=4,
                do_sample=False,
                early_stopping=True,
            )

        text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return (text or "").strip()
