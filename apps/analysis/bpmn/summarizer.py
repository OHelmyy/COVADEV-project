from __future__ import annotations
from typing import List, Optional

from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

MODEL_NAME = "Qwen/Qwen2.5-1.5B-Instruct"

_tokenizer = None
_model = None

<<<<<<< HEAD
def _get_model():
    global _tokenizer, _model
    if _tokenizer is None or _model is None:
        _tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME,
            torch_dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True,
        )
        _model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True,
        )
    return _tokenizer, _model
=======
MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"  # use 1.5B (fast)
>>>>>>> feature/singelton-pattern


def build_bpmn_summary_input(process_name: Optional[str], tasks: List[str]) -> str:
    tasks = [t.strip() for t in tasks if t and t.strip()]
    tasks_txt = "; ".join(tasks[:20])

    return (
        "Write a concise 2-3 sentence business summary of this BPMN workflow. "
        "Mention the overall goal, the main phases, and the final outcome. "
        f"Process name: {process_name or 'N/A'}. "
        f"Tasks: {tasks_txt}."
    )


def summarize_bpmn_text(text: str) -> str:
    tokenizer, model = _get_model()

    messages = [
        {"role": "system", "content": "You are a business analyst writing precise workflow summaries."},
        {"role": "user", "content": text},
    ]

    chat = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )

    inputs = tokenizer(chat, return_tensors="pt").to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=100,
            temperature=0.2,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated = outputs[0][inputs["input_ids"].shape[1]:]
    return tokenizer.decode(generated, skip_special_tokens=True).strip()