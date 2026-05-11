# apps/analysis/code/base_extractor.py
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

class BaseExtractor(ABC):
    """
    Template Method pattern base class for code extractors.
    """
    def __init__(self, language: str):
        self.language = language.lower()

    def extract_from_file(self, file_path: Path, project_root: Optional[Path] = None) -> List[Dict[str, Any]]:
        """
        The Template Method: defines the skeleton of extraction.
        """
        try:
            source = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return []

        rel_path = self._get_rel_path(file_path, project_root)
        
        # Subclasses provide the 'Strategy' for parsing
        items = self.get_functions(source, rel_path)
        
        # Post-process: normalize into a standard schema
        return [self.normalize_item(item, rel_path) for item in items]

    @abstractmethod
    def get_functions(self, source: str, rel_path: str) -> List[Dict[str, Any]]:
        """
        Subclasses must override this to implement language-specific parsing logic.
        """
        pass

    def _get_rel_path(self, file_path: Path, project_root: Optional[Path] = None) -> str:
        if project_root:
            try:
                return Path(file_path).relative_to(project_root).as_posix()
            except ValueError:
                pass
        return Path(file_path).as_posix()

    def normalize_item(self, item: Dict[str, Any], rel_path: str) -> Dict[str, Any]:
        """
        Ensures the extracted item matches the CodeArtifact/Matching expectations.
        """
        start_line = item.get("start_line", 1)
        name = item.get("name") or "unknown"
        
        # Default UID if not provided
        uid = item.get("function_uid") or f"{rel_path}::{name}@L{start_line}"
        
        return {
            "function_uid": uid,
            "file_path": rel_path,
            "language": self.language,
            "function_name": name,
            "symbol": name,
            "kind": item.get("kind") or "function",
            "raw_snippet": item.get("raw_snippet") or "",
            "calls": item.get("calls") or [],
            "writes": item.get("writes") or [],
            "returns": item.get("returns") or [],
            "exceptions": item.get("exceptions") or [],
            "parameters": item.get("parameters") or [],
            "start_line": start_line,
            "end_line": item.get("end_line", start_line),
        }

    def _extract_brace_block(self, source: str, start_pos: int) -> str:
        """
        Extracts a block of code starting from start_pos by counting balanced braces.
        """
        brace_start = source.find('{', start_pos)
        if brace_start == -1:
            # Fallback: take next 10 lines
            lines = source[start_pos:].splitlines()
            return "\n".join(lines[:10])
        
        count = 1
        i = brace_start + 1
        while i < len(source) and count > 0:
            if source[i] == '{':
                count += 1
            elif source[i] == '}':
                count -= 1
            i += 1
        
        return source[start_pos:i]
