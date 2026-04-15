from __future__ import annotations

from typing import List
import re

from apps.analysis.summary.shared_model_singleton import ModelProvider


def build_prompt(summary: str) -> str:
    summary = (summary or "").strip()
    return (
        "You are a senior software architect and process auditor.\n"
        "Based on the workflow summary below, generate 6-10 recommended backend function names.\n\n"
        "Each recommendation must:\n"
        "1) Be a meaningful backend function name in snake_case.\n"
        "2) Follow this exact format:\n"
        "   - function_name: Short technical description.\n"
        "3) The description must explain the function's responsibility clearly.\n"
        "4) Do NOT repeat workflow task names.\n"
        "5) Do NOT restate workflow steps.\n"
        "6) Focus on best practices such as validation, security, logging, error handling, monitoring, role control, transactions, retries, or auditing.\n"
        "7) Return ONLY bullet points. No explanations.\n\n"
        f"Workflow summary:\n{summary}\n"
    )


def normalize(lines_text: str) -> List[str]:
    out: List[str] = []
    seen = set()

    for raw in (lines_text or "").splitlines():
        s = raw.strip()
        if not s:
            continue

        s = re.sub(r"^\d+\.\s*", "", s)
        s = s.lstrip("•*").strip()

        if s.startswith("-"):
            s = s[1:].strip()

        if not s:
            continue

        s = "- " + s
        k = s.lower()
        if k in seen:
            continue

        seen.add(k)
        out.append(s)

    return out[:10]


def generate_recommendations_local(summary: str) -> List[str]:
    provider = ModelProvider()
    prompt = build_prompt(summary)

    try:
        response = provider.client.chat.completions.create(
            model=provider.model_name,
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior software architect and process auditor.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.2,
            max_tokens=400,
        )
        text = response.choices[0].message.content.strip()
        return normalize(text)
    except Exception as e:
        print(f"Groq API call failed: {e}")
        return []


def run_recommendation_pipeline(summary: str):
    """
    Factory-based wrapper for recommendation pipeline.
    """
    from apps.analysis.pipelines.pipeline_factory import PipelineFactory

    pipeline = PipelineFactory.create_recommendation(summary=summary)
    return pipeline.run()
