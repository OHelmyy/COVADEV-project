# apps/analysis/summary/postprocess.py
from __future__ import annotations
import re

def _clean_spaces(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s

def _word_count(s: str) -> int:
    return len([w for w in (s or "").strip().split() if w])

def validate_one_sentence(s: str) -> str:
    s = _clean_spaces(s)

    if "\n" in s:
        raise ValueError("Summary must be exactly one sentence (no newlines).")

    # good-enough one sentence check
    if s.count(".") > 1:
        raise ValueError("Summary must be exactly one sentence.")

    wc = _word_count(s)
    if wc < 12 or wc > 22:
        raise ValueError(f"Summary must be 12–22 words (got {wc}).")

    return s

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
