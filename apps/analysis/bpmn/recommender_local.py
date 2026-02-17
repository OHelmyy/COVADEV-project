from __future__ import annotations
from typing import List
import re
import requests

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL = "llama3.2:3b"


def build_prompt(summary: str) -> str:
    summary = (summary or "").strip()
    return (
        "You are a senior software process auditor.\n"
        "Generate 6-10 best-practice recommendations for improving the workflow.\n"
        "Rules:\n"
        "1) Do NOT repeat workflow task names.\n"
        "2) Do NOT restate steps.\n"
        "3) Return ONLY bullet points.\n"
        "4) Each line MUST start with '- '.\n\n"
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