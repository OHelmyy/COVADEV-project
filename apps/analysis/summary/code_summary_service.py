from __future__ import annotations
from typing import Any, Dict, List

from .generator import build_generator_block
from .shared_model_singleton import ModelProvider

# CODE_COMPARE_RULES = """Write ONE short technical sentence describing what this function does.

# Rules:
# - Describe actual system behavior (validate, fetch, update, save, return)
# - Mention the main object (user, order, payment, database, request)
# - Do NOT start with "This function", "The function", etc
# - No explanation
# - Make it useful for semantic matching with BPMN
# """

# CODE_COMPARE_RULES = """Write one short sentence describing what the code does.

# Rules:
# - Describe actual system behavior (validate, fetch, update, save, return)
#  - Do NOT rephrase or repeat the function name as the summary
#  - If the code returns a value, say what it returns and from where
#  - If the code validates something, say what condition it checks
#  - If the code saves something, say what it saves and where
#  - Mention actual objects (dictionary, list, string, database record)
#  - Do NOT start with "This function", "The function", function name
#  - One sentence only, complete sentence, no cut off
#  - Make it useful for semantic matching with BPMN business tasks
# """
CODE_COMPARE_RULES = """Analyze this code and write ONE sentence describing what it does.

Focus:
- 80% business purpose: what real-world action does this perform? (search, add, apply, confirm, charge, send)
- 20% technical: what key mechanism does it use? (lookup, append, calculate, build, call, update)
Rules:
- Infer business meaning from the LOGIC, not from variable names
- Never use technical terms like dictionary, list, array, object, variable, parameter
- Ignore all parameter names (q, r, s, c, o, etc.)
- Mention the real-world object (book, cart, order, payment, discount, email)
- Start with a verb
- One sentence only, ending with a period
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
    prefixes = ["this function", "the function", "this method", "the method", "the code"]
    for p in prefixes:
        if t.lower().startswith(p):
            t = t[len(p):].strip()

    if t.lower().startswith("is "):
        t = t[3:].strip()

    # Keep only first sentence
    if "." in t:
        t = t.split(".")[0].strip() + "."

    return t[:1].upper() + t[1:] if t else t


def fallback_summary(sf: Dict[str, Any]) -> str:
    fn = (sf.get("function_name") or "function").replace("_", " ").strip()
    title = " ".join(w.capitalize() for w in fn.split()) or "Unnamed Function"
    returns = sf.get("returns") or []
    writes = sf.get("writes") or []
    calls = sf.get("calls") or []

    if writes:
        return f"{title} updates and saves data to the system."
    if returns:
        return f"{title} processes the request and returns a result."
    if calls:
        return f"{title} performs its main operation using related services."
    return f"{title} executes its main business logic."

class SummaryService:

    def __init__(self) -> None:
        provider = ModelProvider()
        self.client = provider.client
        self.model_name = provider.model_name
        
    def summarize_many(self, structured_functions: List[Dict]) -> Dict[str, Dict[str, str]]:
        print("EEEE -> functions:", len(structured_functions))
        out: Dict[str, Dict[str, str]] = {}

        for sf in structured_functions:
            uid = (sf.get("function_uid") or "").strip()
            if not uid:
                continue

            block = build_generator_block(sf)
            short_prompt = build_code_compare_prompt(block)
            short_raw = self._call_model(short_prompt)

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

    def _call_model(self, prompt: str) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "You are a precise software analyst."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=80,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Groq API call failed: {e}")
            return ""