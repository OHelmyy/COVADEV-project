from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from django.db import transaction

from apps.analysis.code.structured_extractor import extract_structured_from_directory
from apps.analysis.models_code import CodeArtifact
from apps.analysis.summary.service import SummaryService
from apps.analysis.summary.structured_summary import build_structured_summary


def _fallback_summary(sf: Dict[str, Any]) -> str:
    fn = (sf.get("function_name") or "function").replace("_", " ").strip()
    return f"{fn} implements its main behavior based on the available code context."


def index_code_zip_for_project(*, project, extracted_dir: Path) -> Dict[str, Any]:
    """
    1) Extract structured functions from code directory
    2) Generate LLM summaries (short + detailed)
    3) Save/update CodeArtifact rows for this project
    """
    structured_functions = extract_structured_from_directory(extracted_dir, project_root=extracted_dir)

    summarizer = SummaryService()
    try:
        res_all = summarizer.summarize_many(structured_functions)  # {uid: {"short":..., "detailed":...}}
    except Exception as e:
        res_all = {}
        global_error = str(e)
    else:
        global_error = ""

    created_or_updated = 0
    failed = 0

    with transaction.atomic():
        for sf in structured_functions:
            uid = (sf.get("function_uid") or "").strip()
            if not uid:
                continue

            # summary
            val = res_all.get(uid) or {}
            short = (val.get("short") or "").strip() if isinstance(val, dict) else str(val).strip()
            detailed = (val.get("detailed") or "").strip() if isinstance(val, dict) else ""

            if not short:
                short = _fallback_summary(sf)
                failed += 1

            structured_ui = ""
            try:
                structured_ui = build_structured_summary(sf)
            except Exception:
                structured_ui = detailed or ""

            CodeArtifact.objects.update_or_create(
                project=project,
                code_uid=uid,
                defaults={
                    "file_path": (sf.get("file_path") or "").strip(),
                    "language": (sf.get("language") or "python").strip() or "python",
                    "symbol": (sf.get("function_name") or "").strip(),
                    "kind": (sf.get("kind") or "function").strip() or "function",
                    "raw_snippet": sf.get("raw_snippet", "") or "",
                    "calls": sf.get("calls") or [],
                    "writes": sf.get("writes") or [],
                    "returns": sf.get("returns") or [],
                    "exceptions": sf.get("exceptions") or [],
                    "summary_text": short,
                    "structured_summary": structured_ui,
                },
            )
            created_or_updated += 1

    return {
        "structured_functions": len(structured_functions),
        "saved": created_or_updated,
        "failed_summaries": failed,
        "global_error": global_error,
    }
