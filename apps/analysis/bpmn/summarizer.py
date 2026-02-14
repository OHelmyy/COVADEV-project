from __future__ import annotations
from typing import List, Optional

from apps.analysis.semantic.model_registry import get_t5_bundle

# ✅ Better model than t5-small
DEFAULT_MODEL = "google/flan-t5-base"


def build_bpmn_summary_input(process_name: Optional[str], tasks: List[str]) -> str:
    tasks = [t.strip() for t in tasks if t and t.strip()]
    tasks_txt = "; ".join(tasks[:20])

    # ✅ Guided prompt gives more "business-like" summary
    return (
        "Write a concise 2-3 sentence business summary of this BPMN workflow. "
        "Mention the overall goal, the main phases, and the final outcome. "
        f"Process name: {process_name or 'N/A'}. "
        f"Tasks: {tasks_txt}."
    )


def summarize_bpmn_text(text: str, model_name: str = DEFAULT_MODEL) -> str:
    tokenizer, model, device = get_t5_bundle(model_name)

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
    ).to(device)

    import torch
    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=90,
            num_beams=4,
            do_sample=False,
            early_stopping=True,
        )

    return tokenizer.decode(output_ids[0], skip_special_tokens=True).strip()