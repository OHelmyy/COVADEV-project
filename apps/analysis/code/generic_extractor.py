# apps/analysis/code/generic_extractor.py
import re
from typing import Any, Dict, List
from .base_extractor import BaseExtractor

class GenericExtractor(BaseExtractor):
    """
    Fallback extractor for other languages (Go, PHP, Swift, etc.)
    Uses broad patterns common to many languages.
    """
    # Pattern 1: name(...) {
    GENERIC_PATTERN = re.compile(
        r"(?:(?:func|function|def|sub|routine)\s+)?(\w+)\s*\([^\)]*\)\s*\{",
        re.MULTILINE
    )

    def __init__(self, language: str = "generic"):
        super().__init__(language)

    def get_functions(self, source: str, rel_path: str) -> List[Dict[str, Any]]:
        items = []
        for match in self.GENERIC_PATTERN.finditer(source):
            name = match.group(1)
            if name in {"if", "for", "while", "switch", "catch", "return"}:
                continue

            start_pos = match.start()
            start_line = source[:start_pos].count("\n") + 1
            
            raw_snippet = self._extract_brace_block(source, start_pos)
            end_line = start_line + raw_snippet.count("\n")

            items.append({
                "name": name,
                "start_line": start_line,
                "end_line": end_line,
                "raw_snippet": raw_snippet,
                "kind": "function"
            })
        
        return items
