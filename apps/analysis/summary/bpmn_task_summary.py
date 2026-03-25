from __future__ import annotations

from typing import Optional
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_NAME,
    trust_remote_code=True,
)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True,
)


def summarize_bpmn_task_text(prompt: str) -> str:
    messages = [
        {"role": "system", "content": "You are a precise business analyst."},
        {"role": "user", "content": prompt},
    ]

    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )

    inputs = tokenizer(text, return_tensors="pt").to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=24,
            temperature=0.2,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated_ids = outputs[0][inputs["input_ids"].shape[1]:]
    result = tokenizer.decode(generated_ids, skip_special_tokens=True).strip()
    return result

def build_bpmn_task_summary_input(name, description):
    desc = (description or "").strip()

    return (
        "Write ONE short technical sentence describing what this BPMN task does.\n\n"
        "Rules:\n"
        "- Describe actual system behavior (read, validate, update, process, generate, return)\n"
        "- Mention the main object (order, payment, report, user input, data)\n"
        "- If the description is missing, infer the summary from the task name only\n"
        "- Do NOT say the task is undefined, missing, unknown, or lacking context\n"
        "- Do NOT ask for more details\n"
        "- Do NOT invent systems unless explicitly mentioned\n"
        "- Do NOT start with 'This task', 'The task', etc\n"
        "- No explanation\n"
        "- Make it useful for semantic matching with code functions\n\n"
        f"Task name: {name or 'Unknown'}\n"
        f"Task description: {desc if desc else 'Missing'}"
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
        "Rewrite the BPMN task summary as ONE short technical sentence.\n\n"
        "Rules:\n"
        "- Describe actual system behavior\n"
        "- Mention the main object\n"
        "- Do NOT say the task is undefined, unknown, or missing context\n"
        "- Do NOT ask for more details\n"
        "- Do NOT explain limitations\n"
        "- Output only the corrected sentence\n\n"
        f"Task name: {name or 'Unknown'}\n"
        f"Task description: {description or 'Not provided'}\n"
        f"Bad summary to fix: {bad_output or ''}"
    )

def summarize_bpmn_task(name: Optional[str], description: Optional[str]) -> str:
    prompt = build_bpmn_task_summary_input(name, description)
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
    ]

    t = text.strip()

    for p in prefixes:
        if t.lower().startswith(p):
            t = t[len(p):].strip()

    # remove leading "is" if it appears after trimming
    if t.lower().startswith("is "):
        t = t[3:].strip()

    # capitalize properly
    return t[:1].upper() + t[1:]