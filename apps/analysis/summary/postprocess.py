# apps/analysis/summary/postprocess.py
import re

def validate_code_compare_line(s: str) -> str:
    s = re.sub(r"\s+", " ", (s or "").strip())

    if "\n" in s:
        raise ValueError("Must be one line (no newlines).")

    if not s.startswith("Task:") or " Description: " not in s:
        raise ValueError("Must follow: Task: <Title>. Description: <Sentence>.")

    # split
    m = re.match(r"^Task:\s*(.+?)\.\s*Description:\s*(.+)$", s)
    if not m:
        raise ValueError("Invalid format; expected period after title.")

    title = m.group(1).strip()
    desc = m.group(2).strip()

    # Title: 2–6 words
    title_words = [w for w in title.split() if w]
    if len(title_words) < 2 or len(title_words) > 6:
        raise ValueError("Title must be 2–6 words.")

    # Description: 12–22 words (one sentence)
    desc_words = [w for w in re.sub(r"[^A-Za-z0-9\s]", " ", desc).split() if w]
    wc = len(desc_words)
    if wc < 12 or wc > 22:
        raise ValueError(f"Description must be 12–22 words (got {wc}).")

    # keep it one sentence-ish (allow final period)
    if desc.count(".") > 1:
        raise ValueError("Description should be one sentence.")

    return s


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
