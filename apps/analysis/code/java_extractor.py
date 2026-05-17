# apps/analysis/code/java_extractor.py
import re
from typing import Any, Dict, List
from apps.analysis.code.base_extractor import BaseExtractor

class JavaExtractor(BaseExtractor):
    # Regex for Java methods: [access] [static] [return_type] name(params) {
    # Covers most standard Java method declarations
    METHOD_PATTERN = re.compile(
        r"(?:public|protected|private|static|\s)+\s+[\w<>\[\]\.,\s]+?\s+(\w+)\s*\([^\)]*\)\s*(?:throws [\w\.\s,]+)?\s*\{",
        re.MULTILINE
    )

    def __init__(self):
        super().__init__("java")

    def get_functions(self, source: str, rel_path: str) -> List[Dict[str, Any]]:
        items = []
        for match in self.METHOD_PATTERN.finditer(source):
            name = match.group(1)
            # Skip common keywords that might match the regex
            if name in {"if", "for", "while", "switch", "catch", "new"}:
                continue

            start_pos = match.start()
            start_line = source[:start_pos].count("\n") + 1
            
            # Use the template's brace-counting helper
            raw_snippet = self._extract_brace_block(source, start_pos)
            end_line = start_line + raw_snippet.count("\n")

            items.append({
                "name": name,
                "start_line": start_line,
                "end_line": end_line,
                "raw_snippet": raw_snippet,
                "kind": "method"
            })
        
        return items
