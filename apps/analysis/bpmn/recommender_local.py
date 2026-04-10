from __future__ import annotations

from typing import List
import re

import torch

from apps.analysis.llm.qwen_registry import get_qwen_bundle

MODEL_NAME = "Qwen/Qwen2.5-1.5B-Instruct"


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
    tokenizer, model = get_qwen_bundle(MODEL_NAME)

    prompt = build_prompt(summary)

    messages = [
        {
            "role": "system",
            "content": "You are a senior software architect and process auditor.",
        },
        {
            "role": "user",
            "content": prompt,
        },
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
            max_new_tokens=220,
            temperature=0.2,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated = outputs[0][inputs["input_ids"].shape[1]:]
    text = tokenizer.decode(generated, skip_special_tokens=True).strip()
    return normalize(text)

    try:
        r = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.2,
                    "num_predict": 220,
                },
            },
            timeout=360,
        )
        r.raise_for_status()
        data = r.json()
        text = data.get("response", "") or ""
        return normalize(text)
    except requests.exceptions.ConnectionError:
        raise ValueError(
            f"Ollama is not running. Please start Ollama and make sure "
            f"'{MODEL}' model is available at {OLLAMA_URL}."
        )
    except requests.exceptions.Timeout:
        raise ValueError(
            "Ollama request timed out. The model may be too slow or unresponsive."
        )
    except Exception as e:
        raise ValueError(f"Recommendation generation failed: {str(e)}")

def run_recommendation_pipeline(summary: str):
    """
    Factory-based wrapper for recommendation pipeline.
    """
    from apps.analysis.pipelines.pipeline_factory import PipelineFactory

    pipeline = PipelineFactory.create_recommendation(summary=summary)
    return pipeline.run()