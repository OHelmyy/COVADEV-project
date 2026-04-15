from __future__ import annotations

from typing import List, Optional

from apps.analysis.summary.shared_model_singleton import ModelProvider


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
    provider = ModelProvider()

    try:
        response = provider.client.chat.completions.create(
            model=provider.model_name,
            messages=[
                {
                    "role": "system",
                    "content": "You are a business analyst writing precise workflow summaries.",
                },
                {
                    "role": "user",
                    "content": text,
                },
            ],
            temperature=0.2,
            max_tokens=200,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Groq API call failed: {e}")
        return ""
