# apps/analysis/summary/postprocess.py
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


# ✅ Backward-compatible names used by SummaryService
def validate_one_sentence(s: str) -> str:
    """
    Old API name expected by SummaryService.
    For Compare tab we want the strict 'Task: ... Description: ...' one-liner.
    """
    return validate_code_compare_line(s)


def validate_detailed(s: str) -> str:
    """
    Used for detailed UI/debug summaries: allow multiple sentences, just clean formatting.
    """
    s = (s or "").strip()
    s = re.sub(r"[ \t]+", " ", s)      # collapse spaces/tabs
    s = re.sub(r"\n{3,}", "\n\n", s)   # limit excessive blank lines
    return s
