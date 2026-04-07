# apps/projects/services.py
from __future__ import annotations

import shutil
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import transaction

from .models import Project, ProjectFile, CodeFile
from apps.analysis.code.structured_extractor import extract_structured_from_directory
from apps.analysis.summary.code_summary_service import SummaryService
from apps.analysis.models_code import CodeArtifact
import traceback



# ============================================================
# BPMN upload (project-based, no versions)
# ============================================================

def save_bpmn_file(project: Project, uploaded_file, uploader):
    """
    Save BPMN for project (no versions).

    - Stores file under: media/projects/<project_id>/bpmn/<filename>
    - Creates ProjectFile log row (includes who uploaded)
    - Updates project.active_bpmn pointer
    """
    project_dir = Path(settings.MEDIA_ROOT) / "projects" / str(project.id) / "bpmn"
    project_dir.mkdir(parents=True, exist_ok=True)

    rel_bpmn_path = Path("projects") / str(project.id) / "bpmn" / uploaded_file.name
    stored_path = default_storage.save(str(rel_bpmn_path), uploaded_file)
    pf = ProjectFile.objects.create(
        project=project,
        file_type="BPMN",
        original_name=uploaded_file.name,
        stored_path=stored_path,
        uploaded_by=uploader,
    )

    project.active_bpmn = pf
    project.save(update_fields=["active_bpmn"])
    return pf


# ============================================================
# ZIP extraction helpers (project-based, no versions)
# ============================================================

def _is_symlink(member: zipfile.ZipInfo) -> bool:
    """
    Detect symlinks inside zip (important security detail).
    Works on Unix-created zips.
    """
    return (member.external_attr >> 16) & 0o120000 == 0o120000


def _safe_extract_zip(zip_file_path: Path, extract_to: Path):
    """
    Secure extraction to prevent:
    - path traversal (../)
    - symlink attacks

    Raises ValueError if zip content is unsafe.
    """
    extract_to = extract_to.resolve()

    with zipfile.ZipFile(zip_file_path, "r") as zf:
        for member in zf.infolist():
            if member.is_dir():
                continue

            if _is_symlink(member):
                raise ValueError("Unsafe zip content (symlink detected).")

            member_path = Path(member.filename)
            resolved = (extract_to / member_path).resolve()

            if not str(resolved).startswith(str(extract_to)):
                raise ValueError("Unsafe zip content (path traversal detected).")

        zf.extractall(extract_to)


def _index_code_files(project: Project, code_root_dir: Path, uploader):
    """
    Scan extracted directory and store file list in CodeFile table.

    Notes:
    - Replaces previous index for this project.
    - Ignores junk folders and system files.
    """
    CodeFile.objects.filter(project=project).delete()

    code_root_dir = code_root_dir.resolve()

    ignore_dirs = {"__pycache__", ".git", "node_modules", "venv", ".idea", ".vscode"}
    ignore_files = {".ds_store", "thumbs.db"}

    for p in code_root_dir.rglob("*"):
        if not p.is_file():
            continue

        if p.name.lower() in ignore_files:
            continue

        if any(part.lower() in ignore_dirs for part in p.parts):
            continue

        rel = p.relative_to(code_root_dir).as_posix()
        ext = p.suffix.lower().lstrip(".")
        size = p.stat().st_size

        CodeFile.objects.create(
            project=project,
            relative_path=rel,
            ext=ext,
            size_bytes=size,
            uploaded_by=uploader,
        )


# ============================================================
# ✅ Code Summarization helpers
# ============================================================

def _fallback_summary(sf: Dict[str, Any]) -> str:
    fn = (sf.get("function_name") or "function").replace("_", " ").strip()
    title = " ".join(w.capitalize() for w in fn.split()) or "Unnamed Function"
    returns = sf.get("returns") or []
    writes = sf.get("writes") or []
    calls = sf.get("calls") or []

    if writes:
        return f"{title} updates and saves data to the system."
    if returns:
        return f"{title} processes the request and returns a result."
    if calls:
        return f"{title} performs its main operation using related services."
    return f"{title} executes its main business logic."
def _persist_code_artifacts_with_summaries(
    *,
    project: Project,
    code_root_dir: Path,
) -> Dict[str, Any]:
    """
    Extract structured functions from the extracted code folder,
    generate LLM summaries, and save/update CodeArtifact rows.

    Returns a summary dict with counts and any errors encountered.
    """
    structured_functions = extract_structured_from_directory(
        code_root_dir,
        project_root=code_root_dir,
    )

    summaries_by_uid: Dict[str, Any] = {}
    summary_errors: Dict[str, str] = {}
    global_error: str = ""

    summarizer = SummaryService()
    try:
        summaries_by_uid = summarizer.summarize_many(structured_functions)
    except Exception as e:
        global_error = str(e)
        summary_errors["__GLOBAL__"] = global_error
        summaries_by_uid = {}

    saved = 0
    failed = 0

    with transaction.atomic():
        for sf in structured_functions:
            uid = (sf.get("function_uid") or "").strip()
            if not uid:
                continue

            fn_name = (sf.get("function_name") or "").strip()
            file_path = (sf.get("file_path") or "").strip()

            short = (summaries_by_uid.get(uid) or "").strip()

            if not short:
                short = _fallback_summary(sf)
                failed += 1
                if uid not in summary_errors:
                    summary_errors[uid] = "Empty/failed model summary (fallback used)"

            structured_ui = ""

            try:
                CodeArtifact.objects.update_or_create(
                    project=project,
                    code_uid=uid,
                    defaults={
                        "file_path": file_path,
                        "language": (sf.get("language") or "python").strip() or "python",
                        "symbol": fn_name,
                        "kind": (sf.get("kind") or "function").strip() or "function",
                        "raw_snippet": sf.get("raw_snippet") or "",
                        "calls": sf.get("calls") or [],
                        "writes": sf.get("writes") or [],
                        "returns": sf.get("returns") or [],
                        "exceptions": sf.get("exceptions") or [],
                        "summary_text": short,
                        "structured_summary": structured_ui,
                    },
                )
                saved += 1
            except Exception as e:
                summary_errors[uid] = f"DB save failed: {str(e)}"

    return {
        "structured_functions": len(structured_functions),
        "saved": saved,
        "failed_summaries": failed,
        "global_error": global_error,
        "errors_sample": dict(list(summary_errors.items())[:5]),
    }

# ============================================================
# Code ZIP upload (project-based, no versions)
# ============================================================

def save_code_zip_and_extract(project: Project, uploaded_zip, uploader):
    """
    Save ZIP, extract into:
      media/projects/<project_id>/code/extracted/

    Index CodeFile rows, log upload in ProjectFile, and
    ✅ generate CodeArtifact summaries immediately after upload.

    Behavior:
    - Stores the ZIP file under code folder (audit)
    - Clears old extracted code folder content before extracting
    - Updates project.active_code pointer
    """
    code_root = Path(settings.MEDIA_ROOT) / "projects" / str(project.id) / "code"
    code_root.mkdir(parents=True, exist_ok=True)

    # Keep zip audit file in code_root, but extract into a clean subfolder
    extract_dir = code_root / "extracted"

    # Clear old extracted content
    if extract_dir.exists():
        try:
            shutil.rmtree(extract_dir)
        except Exception:
            pass
    extract_dir.mkdir(parents=True, exist_ok=True)

    # Optionally clear old zip files in code_root (keep folder)
    # If you want to keep all past zips, remove this block.
    for child in code_root.iterdir():
        try:
            if child.is_file() and child.suffix.lower() == ".zip":
                child.unlink()
        except Exception:
            pass

    # Save ZIP file using RELATIVE path (relative to MEDIA_ROOT)
    rel_zip_path = Path("projects") / str(project.id) / "code" / uploaded_zip.name
    stored_zip_path = default_storage.save(str(rel_zip_path), uploaded_zip)

    # Absolute path for extraction
    zip_full_path = Path(settings.MEDIA_ROOT) / stored_zip_path

    # Extract safely and index files
    _safe_extract_zip(zip_full_path, extract_dir)
    _index_code_files(project, extract_dir, uploader)

    # Log upload
    pf = ProjectFile.objects.create(
        project=project,
        file_type="CODE",
        original_name=uploaded_zip.name,
        stored_path=stored_zip_path,
        extracted_dir=str(extract_dir),
        uploaded_by=uploader,
    )

    # Mark as active Code ZIP
    project.active_code = pf
    project.save(update_fields=["active_code"])
    return pf
