# apps/analysis/code/structured_extractor.py
from __future__ import annotations

import ast
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class StructuredFunction:
    function_uid: str
    file_path: str
    language: str
    function_name: str
    signature: str
    parameters: List[str]
    calls: List[str]
    writes: List[str]
    returns: List[str]
    exceptions: List[str]
    class_name: Optional[str]
    start_line: int
    end_line: int
    raw_snippet: str
    developer_id: Optional[str] = None


def _rel_path(p: Path, root: Optional[Path]) -> str:
    if root:
        try:
            return str(p.relative_to(root))
        except ValueError:
            pass
    return str(p)


def _get_src_lines(src: str, start: int, end: int) -> str:
    lines = src.splitlines()
    s = max(0, start - 1)
    e = min(len(lines), end)
    return "\n".join(lines[s:e])


def _signature(fn: ast.FunctionDef) -> str:
    params: List[str] = []
    for a in fn.args.args:
        params.append(a.arg)
    return f"{fn.name}({', '.join(params)})"


def _attr_chain(node: ast.AST) -> Optional[str]:
    """
    Best-effort: build 'a.b.c' from Name/Attribute nodes.
    Examples:
      - self.repo.get -> "self.repo.get"
      - repo.get -> "repo.get"
      - obj.save -> "obj.save"
    """
    parts: List[str] = []
    cur = node
    while isinstance(cur, ast.Attribute):
        parts.append(cur.attr)
        cur = cur.value
    if isinstance(cur, ast.Name):
        parts.append(cur.id)
    else:
        return None
    return ".".join(reversed(parts))


class _Visitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.calls: List[str] = []
        self.writes: List[str] = []
        self.returns: List[str] = []
        self.exceptions: List[str] = []

    def visit_Call(self, node: ast.Call) -> None:
        name = _attr_chain(node.func)
        if not name and isinstance(node.func, ast.Name):
            name = node.func.id

        if name:
            self.calls.append(name)
        self.generic_visit(node)

    def visit_Assign(self, node: ast.Assign) -> None:
        # capture writes like: order.status = ..., self.x = ...
        for t in node.targets:
            target = _attr_chain(t) or (t.id if isinstance(t, ast.Name) else None)
            if target:
                self.writes.append(target)
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        target = _attr_chain(node.target) or (node.target.id if isinstance(node.target, ast.Name) else None)
        if target:
            self.writes.append(target)
        self.generic_visit(node)

    def visit_Return(self, node: ast.Return) -> None:
        if node.value is None:
            self.returns.append("None")
        elif isinstance(node.value, ast.Constant):
            self.returns.append(str(node.value.value))
        else:
            self.returns.append("expr")
        self.generic_visit(node)

    def visit_Raise(self, node: ast.Raise) -> None:
        # raise ValueError(...) -> "ValueError"
        if isinstance(node.exc, ast.Call):
            nm = _attr_chain(node.exc.func)
            if nm:
                self.exceptions.append(nm)
        elif isinstance(node.exc, ast.Name):
            self.exceptions.append(node.exc.id)
        self.generic_visit(node)


def _build_one(
    node: ast.FunctionDef,
    *,
    src: str,
    rel: str,
    class_name: Optional[str],
) -> Dict[str, Any]:
    start = int(getattr(node, "lineno", 1))
    end = int(getattr(node, "end_lineno", start))
    raw_snippet = _get_src_lines(src, start, end)

    v = _Visitor()
    v.visit(node)

    owner = f"{class_name}." if class_name else ""
    uid = f"{rel}::{owner}{node.name}@L{start}-L{end}"

    sf = StructuredFunction(
        function_uid=uid,
        file_path=rel,
        language="python",
        function_name=node.name,
        signature=_signature(node),
        parameters=[a.arg for a in node.args.args],
        calls=list(dict.fromkeys(v.calls))[:12],
        writes=list(dict.fromkeys(v.writes))[:12],
        returns=list(dict.fromkeys(v.returns))[:8],
        exceptions=list(dict.fromkeys(v.exceptions))[:8],
        class_name=class_name,
        start_line=start,
        end_line=end,
        raw_snippet=raw_snippet,
        developer_id=None,
    )
    d = asdict(sf)

    # OPTIONAL: Add "kind" safely without touching your DB model
    # Your models_code.py has 'kind' and default is "function".
    d["kind"] = "method" if class_name else "function"

    return d


def extract_structured_functions(
    py_file: Path,
    project_root: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    src = py_file.read_text(encoding="utf-8", errors="ignore")
    tree = ast.parse(src)

    rel = _rel_path(py_file, project_root)
    out: List[Dict[str, Any]] = []

    # IMPORTANT:
    # Avoid ast.walk(tree) to prevent nested function duplication.
    # Only extract:
    # - top-level functions
    # - methods inside classes
    for top in tree.body:
        if isinstance(top, ast.FunctionDef):
            out.append(_build_one(top, src=src, rel=rel, class_name=None))
        elif isinstance(top, ast.ClassDef):
            for item in top.body:
                if isinstance(item, ast.FunctionDef):
                 out.append(_build_one(item, src=src, rel=rel, class_name=top.name))

    return out


def extract_structured_from_directory(
    root_dir: Path,
    project_root: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    res: List[Dict[str, Any]] = []
    for py in root_dir.rglob("*.py"):
        res.extend(extract_structured_functions(py, project_root=project_root))
    return res
