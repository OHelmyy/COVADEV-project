# apps/analysis/code/cpp_extractor.py
import re
from typing import Any, Dict, List
from .base_extractor import BaseExtractor

class CppExtractor(BaseExtractor):
    # Regex for C++ functions: [return_type] [class::]name(params) {
    # Handles both global functions and class methods (including namespaces)
    METHOD_PATTERN = re.compile(
        r"(?:[\w\:\<\>\[\]\*\&]+)\s+([\w\:]+)\s*\([^\)]*\)\s*(?:const)?\s*\{",
        re.MULTILINE
    )

    def __init__(self):
        super().__init__("cpp")

    def get_functions(self, source: str, rel_path: str) -> List[Dict[str, Any]]:
        items = []
        for match in self.METHOD_PATTERN.finditer(source):
            full_name = match.group(1)
            # Skip common keywords
            if full_name in {"if", "for", "while", "switch", "catch", "return"}:
                continue

            # In C++, the name might include Class::Method or Namespace::Class::Method
            short_name = full_name.split("::")[-1]

            start_pos = match.start()
            start_line = source[:start_pos].count("\n") + 1
            
            raw_snippet = self._extract_brace_block(source, start_pos)
            end_line = start_line + raw_snippet.count("\n")

            items.append({
                "name": short_name,
                "full_symbol": full_name,
                "start_line": start_line,
                "end_line": end_line,
                "raw_snippet": raw_snippet,
                "kind": "method" if "::" in full_name else "function"
            })
        
        return items
