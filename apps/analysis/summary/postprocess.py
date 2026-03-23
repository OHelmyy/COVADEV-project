# apps/analysis/summary/postprocess.py
from __future__ import annotations
import re

def _clean_spaces(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s

def _word_count(s: str) -> int:
    return len([w for w in (s or "").strip().split() if w])

import re


def validate_one_sentence(text: str) -> str:
    text = (text or "").strip()

    if not text:
        raise ValueError("Summary is empty.")

    # collapse whitespace
    text = re.sub(r"\s+", " ", text)

    # remove wrapping quotes if any
    text = text.strip("\"'“”‘’")

    # count sentence-ending punctuation marks
    sentence_parts = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    if len(sentence_parts) != 1:
        raise ValueError("Summary must be exactly one sentence.")

    # count words robustly
    words = re.findall(r"\b[\w'-]+\b", text)
    wc = len(words)

    if wc < 8 or wc > 14:
        raise ValueError(f"Summary must be between 8 and 14 words (got {wc}).")

    return text

def validate_detailed(s: str) -> str:
    s = (s or "").strip()
    # allow multi sentences, but keep it short & clean
    s = re.sub(r"\s+", " ", s)

    # hard limits so UI doesn't explode
    wc = _word_count(s)
    if wc < 18:
        raise ValueError("Detailed summary is too short.")
    if wc > 120:
        raise ValueError("Detailed summary is too long.")

    return s
