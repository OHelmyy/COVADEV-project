from __future__ import annotations

from typing import Dict, List

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

from .generator import build_generator_block

# CODE_COMPARE_RULES = """Write ONE short technical sentence describing what this function does.

# Rules:
# - Describe actual system behavior (validate, fetch, update, save, return)
# - Mention the main object (user, order, payment, database, request)
# - Do NOT start with "This function", "The function", etc
# - No explanation
# - Make it useful for semantic matching with BPMN
# """

CODE_COMPARE_RULES = """Read the CODE section and write ONE short sentence describing what this code actually does.

Rules:
 - Describe what the code LITERALLY does — what it reads, checks, calculates, or returns
 - Do NOT rephrase or repeat the function name as the summary
 - If the code returns a value, say what it returns and from where
 - If the code validates something, say what condition it checks
 - If the code saves something, say what it saves and where
 - Mention actual objects (dictionary, list, string, database record)
 - Do NOT start with "This function", "The function", function name
 - One sentence only, complete sentence, no cut off
 - Make it useful for semantic matching with BPMN business tasks
 """

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


def clean_summary(text: str) -> str:
    if not text:
        return text

    import re
    t = text.strip()

    # Reject if LLM echoed the input block
    if any(marker in t for marker in ["FUNCTION_NAME:", "PARAMETERS:", "RETURNS:", "CODE:", "CALLS:", "WRITES:"]):
        return ""

    # Remove backticks but keep the word inside
    t = re.sub(r'`([^`]+)`', r'\1', t).strip()

    # Remove _NAME: prefix
    t = re.sub(r'^_?NAME\s*:\s*', '', t, flags=re.IGNORECASE).strip()

    # Remove "The <function_name> function/method" pattern
    t = re.sub(r'^[Tt]he\s+\w+\s+(function|method)\s+', '', t).strip()

    # Remove leading prefixes
    prefixes = ["this function", "the function", "this method", "the method"]
    for p in prefixes:
        if t.lower().startswith(p):
            t = t[len(p):].strip()

    if t.lower().startswith("is "):
        t = t[3:].strip()

    # Keep only first sentence
    if "." in t:
        t = t.split(".")[0].strip() + "."

    return t[:1].upper() + t[1:] if t else t




class SummaryService:
    MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"

    def __init__(self) -> None:
        print("DDDD -> SummaryService init")
        self.tokenizer = AutoTokenizer.from_pretrained(self.MODEL_NAME)
        self.model = AutoModelForCausalLM.from_pretrained(
            self.MODEL_NAME,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto",
        )

    def summarize_many(self, structured_functions: List[Dict]) -> Dict[str, Dict[str, str]]:
        print("EEEE -> functions:", len(structured_functions))
        out: Dict[str, Dict[str, str]] = {}

        for sf in structured_functions:
            uid = (sf.get("function_uid") or "").strip()
            if not uid:
                continue

            block = build_generator_block(sf)

            short_prompt = build_code_compare_prompt(block)

            short_raw = self._call_model(short_prompt, max_new_tokens=48)

            print("UID:", uid)
            print("SHORT RAW:", repr(short_raw))

            try:
                short_clean = clean_summary((short_raw or "").strip())
                short_clean = " ".join(short_clean.splitlines()).strip()
            except Exception as e:
                print("VALIDATION FAILED FOR", uid, "RAW =", repr(short_raw), "ERROR =", str(e))
                short_clean = ""

            out[uid] = short_clean


        return out

    def _call_model(self, prompt: str, max_new_tokens: int) -> str:
        messages = [
            {"role": "system", "content": "You are a precise software analyst."},
            {"role": "user", "content": prompt},
        ]

        text = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        inputs = self.tokenizer(text, return_tensors="pt").to(self.model.device)

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=0.2,
                do_sample=False,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        generated_ids = outputs[0][inputs["input_ids"].shape[1]:]
        result = self.tokenizer.decode(generated_ids, skip_special_tokens=True)
        return result.strip()