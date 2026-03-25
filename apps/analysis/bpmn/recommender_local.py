from __future__ import annotations
from typing import List
import re
import requests

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL = "llama3.2:3b"


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
    prompt = build_prompt(summary)

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