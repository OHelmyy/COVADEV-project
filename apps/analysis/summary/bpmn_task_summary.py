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
            max_new_tokens=40,
            temperature=0.2,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated_ids = outputs[0][inputs["input_ids"].shape[1]:]
    result = tokenizer.decode(generated_ids, skip_special_tokens=True).strip()
    return result
def build_bpmn_task_summary_input(name, description):
    return (
        "Write ONE short technical sentence describing what this BPMN task does.\n\n"

        "Rules:\n"
        "- Describe actual system behavior (read, validate, update, process, generate, return)\n"
        "- Mention the main object (order, payment, report, user input, data)\n"
        "- Do NOT invent systems (database, API, gateway) unless explicitly mentioned\n"
        "- Do NOT start with 'This task', 'The task', etc\n"
        "- No explanation\n"
        "- Make it useful for semantic matching with code functions\n\n"

        f"Task name: {name or 'Unknown'}\n"
        f"Task description: {description or 'Not provided'}"
    )
def is_weak(summary: str, name: str) -> bool:
    s = (summary or "").lower().strip()
    n = (name or "").lower().strip()

    return (
        len(s.split()) <= 7
        or s == n
        or s == f"{n}."
        or s.startswith("the task")
        or s.startswith("this task")
        or s.startswith("to ")
    )


def summarize_bpmn_task(name: Optional[str], description: Optional[str]) -> str:
    prompt = build_bpmn_task_summary_input(name, description)
    summary = summarize_bpmn_task_text(prompt)
    summary = clean_summary(summary)
    summary = " ".join((summary or "").splitlines()).strip()

    if is_weak(summary, name or ""):
        stronger_prompt = (
            prompt
            + " Expand it with a clearer action, object, and business outcome. "
            "Make it at least 10 words and useful for semantic matching."
        )
        summary = summarize_bpmn_task_text(stronger_prompt)
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