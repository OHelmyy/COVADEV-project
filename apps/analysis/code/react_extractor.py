import re
from pathlib import Path
from typing import Dict, List, Optional

from apps.analysis.code.extractor import normalize_text


JS_EXTS = {".js", ".jsx", ".ts", ".tsx"}


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


def extract_react_code_items(js_file: Path, project_root: Optional[Path] = None) -> List[Dict]:
    """
    Extract "code items" from one JS/TS/JSX/TSX file.

    We extract:
    - React components (function or const/arrow) by naming convention (PascalCase)
    - Exported functions (any case)
    - Top-level functions (best effort)

    Output schema (matches Python extractor):
    {
      "id": "...",
      "type": "component|function",
      "name": "...",
      "text": "...",          # normalized text for embeddings later
      "source_path": "..."    # relative path when project_root is provided
    }
    """
    source = js_file.read_text(encoding="utf-8", errors="ignore")
    lines = source.splitlines()

    rel_path = str(js_file)
    if project_root is not None:
        try:
            rel_path = str(js_file.relative_to(project_root))
        except ValueError:
            rel_path = str(js_file)

    items: List[Dict] = []

    # Patterns:
    # 1) export default function ComponentName(...) { ... }
    p_export_default_func = re.compile(
        r"^\s*export\s+default\s+function\s+([A-Za-z_]\w*)\s*\(",
        re.MULTILINE,
    )

    # 2) export function fnName(...) { ... }
    p_export_func = re.compile(
        r"^\s*export\s+function\s+([A-Za-z_]\w*)\s*\(",
        re.MULTILINE,
    )

    # 3) function fnName(...) { ... }
    p_func = re.compile(
        r"^\s*function\s+([A-Za-z_]\w*)\s*\(",
        re.MULTILINE,
    )

    # 4) export const Name = (...) => ...
    p_export_const_arrow = re.compile(
        r"^\s*export\s+const\s+([A-Za-z_]\w*)\s*=\s*\(?.*?\)?\s*=>",
        re.MULTILINE,
    )

    # 5) const Name = (...) => ...
    p_const_arrow = re.compile(
        r"^\s*const\s+([A-Za-z_]\w*)\s*=\s*\(?.*?\)?\s*=>",
        re.MULTILINE,
    )

    # Collect matches with their approximate start line index
    def _matches_with_line(pattern: re.Pattern) -> List[Dict]:
        out: List[Dict] = []
        for m in pattern.finditer(source):
            name = m.group(1)
            start_idx = source[: m.start()].count("\n")
            out.append({"name": name, "line": start_idx})
        return out

    raw_matches: List[Dict] = []
    raw_matches.extend(_matches_with_line(p_export_default_func))
    raw_matches.extend(_matches_with_line(p_export_func))
    raw_matches.extend(_matches_with_line(p_func))
    raw_matches.extend(_matches_with_line(p_export_const_arrow))
    raw_matches.extend(_matches_with_line(p_const_arrow))

    # Deduplicate by (name, line) to avoid duplicates from overlapping patterns
    seen = set()
    matches: List[Dict] = []
    for m in raw_matches:
        key = (m["name"], m["line"])
        if key in seen:
            continue
        seen.add(key)
        matches.append(m)

    # Classify component vs function:
    # - Component: PascalCase name (common React convention)
    # - Function: anything else
    def _is_component_name(name: str) -> bool:
        return bool(name) and name[0].isupper()

    for m in matches:
        name = m["name"]
        line_index = m["line"]

        leading_comment = _find_leading_comment(lines, line_index)
        raw_text = name
        if leading_comment:
            raw_text = f"{name}\n{leading_comment}"

        normalized = normalize_text(raw_text)

        item_type = "component" if _is_component_name(name) else "function"

        items.append(
            {
                "id": _make_id(rel_path, item_type, name),
                "type": item_type,
                "name": name,
                "text": normalized,
                "source_path": rel_path,
            }
        )

    return items


def extract_react_from_directory(root_dir: Path, project_root: Optional[Path] = None) -> List[Dict]:
    """
    Walk a directory and extract items from all JS/TS/JSX/TSX files.
    """
    results: List[Dict] = []
    for p in root_dir.rglob("*"):
        if p.is_file() and p.suffix in JS_EXTS:
            results.extend(extract_react_code_items(p, project_root=project_root))
    return results
