import ast
import re
from pathlib import Path
from typing import Dict, List, Optional


def _split_identifier(name: str) -> str:
    """
    Convert identifiers into spaced words:
    - snake_case -> "snake case"
    - camelCase / PascalCase -> "camel case" / "pascal case"
    """
    if not name:
        return ""

    # Replace underscores with spaces (snake_case)
    s = name.replace("_", " ")

    # Split camelCase / PascalCase boundaries: "validateUser" -> "validate User"
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", s)

    # Collapse extra whitespace
    s = re.sub(r"\s+", " ", s).strip()

    return s


def normalize_text(text: str) -> str:
    """
    Normalize extracted text for semantic comparison:
    - Lowercase
    - Split identifiers
    - Remove most punctuation
    - Collapse whitespace
    """
    if not text:
        return ""

    text = text.strip()
    text = _split_identifier(text)
    text = text.lower()

    # Keep letters/numbers/spaces; replace other characters with spaces
    text = re.sub(r"[^a-z0-9\s]+", " ", text)

    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()

    return text


def _make_id(source_path: str, item_type: str, name: str) -> str:
    """
    Stable identifier to help traceability later.
    """
    return f"{source_path}:{item_type}:{name}"


def _get_docstring(node: ast.AST) -> str:
    """
    Return docstring for a function/class/module node, or "" if none.
    """
    ds = ast.get_docstring(node)
    return ds.strip() if ds else ""


def extract_python_code_items(py_file: Path, project_root: Optional[Path] = None) -> List[Dict]:
    """
    Extract "code items" from one Python file:
    - functions
    - classes
    along with docstrings.

    Returns a list of dicts:
    {
      "id": "...",
      "type": "function|class",
      "name": "...",
      "text": "...",          # normalized text for embeddings later
      "source_path": "..."    # relative path when project_root is provided
    }
    """
    source = py_file.read_text(encoding="utf-8", errors="ignore")
    tree = ast.parse(source)

    rel_path = str(py_file)
    if project_root is not None:
        try:
            rel_path = str(py_file.relative_to(project_root))
        except ValueError:
            rel_path = str(py_file)

    items: List[Dict] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            name = node.name
            doc = _get_docstring(node)

            raw_text_parts = [name]
            if doc:
                raw_text_parts.append(doc)

            raw_text = " ".join(raw_text_parts)
            text = normalize_text(raw_text)

            items.append(
                {
                    "id": _make_id(rel_path, "function", name),
                    "type": "function",
                    "name": name,
                    "text": text,
                    "source_path": rel_path,
                }
            )

        elif isinstance(node, ast.ClassDef):
            name = node.name
            doc = _get_docstring(node)

            raw_text_parts = [name]
            if doc:
                raw_text_parts.append(doc)

            raw_text = " ".join(raw_text_parts)
            text = normalize_text(raw_text)

            items.append(
                {
                    "id": _make_id(rel_path, "class", name),
                    "type": "class",
                    "name": name,
                    "text": text,
                    "source_path": rel_path,
                }
            )

    return items


def extract_python_from_directory(root_dir: Path, project_root: Optional[Path] = None) -> List[Dict]:
    """
    Walk a directory and extract items from all .py files.
    """
    results: List[Dict] = []
    for py_file in root_dir.rglob("*.py"):
        results.extend(extract_python_code_items(py_file, project_root=project_root))
    return results
