import re
from typing import Any, Dict, List, Optional
from .base_extractor import BaseExtractor

class JavascriptExtractor(BaseExtractor):
    def __init__(self):
        super().__init__("javascript")

    def get_functions(self, source: str, rel_path: str) -> List[Dict[str, Any]]:
        lines = source.splitlines()
        items: List[Dict] = []

        # Patterns from original react_extractor.py
        p_export_default_func = re.compile(r"^\s*export\s+default\s+function\s+([A-Za-z_]\w*)\s*\(", re.MULTILINE)
        p_export_func = re.compile(r"^\s*export\s+function\s+([A-Za-z_]\w*)\s*\(", re.MULTILINE)
        p_func = re.compile(r"^\s*function\s+([A-Za-z_]\w*)\s*\(", re.MULTILINE)
        p_export_const_arrow = re.compile(r"^\s*export\s+const\s+([A-Za-z_]\w*)\s*=\s*\(?.*?\)?\s*=>", re.MULTILINE)
        p_const_arrow = re.compile(r"^\s*const\s+([A-Za-z_]\w*)\s*=\s*\(?.*?\)?\s*=>", re.MULTILINE)

        def _matches_with_line(pattern: re.Pattern) -> List[Dict]:
            out: List[Dict] = []
            for m in pattern.finditer(source):
                name = m.group(1)
                start_idx = source[: m.start()].count("\n")
                out.append({"name": name, "line": start_idx, "start_pos": m.start()})
            return out

        raw_matches: List[Dict] = []
        raw_matches.extend(_matches_with_line(p_export_default_func))
        raw_matches.extend(_matches_with_line(p_export_func))
        raw_matches.extend(_matches_with_line(p_func))
        raw_matches.extend(_matches_with_line(p_export_const_arrow))
        raw_matches.extend(_matches_with_line(p_const_arrow))

        seen = set()
        for m in raw_matches:
            key = (m["name"], m["line"])
            if key in seen:
                continue
            seen.add(key)
            
            name = m["name"]
            line_index = m["line"]
            start_pos = m["start_pos"]

            leading_comment = _find_leading_comment(lines, line_index)
            
            # Use brace counting for snippet if it looks like a block
            raw_snippet = self._extract_brace_block(source, start_pos)
            
            item_type = "component" if (name and name[0].isupper()) else "function"

            items.append({
                "name": name,
                "start_line": line_index + 1,
                "raw_snippet": raw_snippet,
                "kind": item_type,
                "leading_comment": leading_comment
            })

        return items


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()

def _make_id(source_path: str, item_type: str, name: str) -> str:
    return f"{source_path}:{item_type}:{name}"

def _find_leading_comment(lines: List[str], start_line_index: int) -> str:
    """
    Best-effort: capture a comment block immediately above a declaration.

    Supports:
    - // single line comments
    - /* block comments */
    - /** JSDoc style */
    """
    i = start_line_index - 1

    # Skip empty lines above the declaration
    while i >= 0 and lines[i].strip() == "":
        i -= 1

    if i < 0:
        return ""

    line = lines[i].rstrip()

    # Case 1: single-line // comments (possibly multiple lines)
    if line.strip().startswith("//"):
        comment_lines: List[str] = []
        while i >= 0 and lines[i].strip().startswith("//"):
            comment_lines.append(lines[i].strip()[2:].strip())
            i -= 1
        comment_lines.reverse()
        return "\n".join([c for c in comment_lines if c])

    # Case 2: block comments /* ... */ or /** ... */
    if "*/" in line:
        comment_lines: List[str] = []
        # Walk upward until we find /* or /** start
        while i >= 0:
            cur = lines[i].rstrip()
            comment_lines.append(cur)
            if "/*" in cur:
                break
            i -= 1
        comment_lines.reverse()
        block = "\n".join(comment_lines)

        # Remove block markers and leading * formatting
        block = re.sub(r"^\s*/\*\*?", "", block)
        block = re.sub(r"\*/\s*$", "", block)
        block = re.sub(r"^\s*\*\s?", "", block, flags=re.MULTILINE)
        return block.strip()

    return ""
