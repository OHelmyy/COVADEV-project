# apps/projects/services.py

import shutil
import zipfile
from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage

from .models import Project, ProjectFile, CodeFile


# ============================================================
# Project creation (simple helper)
# ============================================================

def create_project(user, name, description=""):
    """
    Create a new Project. (Membership role assignment is handled in views.)
    """
    return Project.objects.create(
        name=name,
        description=description,
        created_by=user,
    )


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

    # Keep original filename (good for MVP)
    file_path = project_dir / uploaded_file.name

    # default_storage returns relative path under MEDIA_ROOT
    stored_path = default_storage.save(str(file_path), uploaded_file)

    # Log upload
    pf = ProjectFile.objects.create(
        project=project,
        file_type="BPMN",
        original_name=uploaded_file.name,
        stored_path=stored_path,
        uploaded_by=uploader,
    )

    # Mark as active BPMN
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
            # skip directories
            if member.is_dir():
                continue

            # block symlinks
            if _is_symlink(member):
                raise ValueError("Unsafe zip content (symlink detected).")

            member_path = Path(member.filename)

            # Resolve destination path & verify it stays inside extract_to
            resolved = (extract_to / member_path).resolve()
            if not str(resolved).startswith(str(extract_to)):
                raise ValueError("Unsafe zip content (path traversal detected).")

        # If all safe -> extract
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

        # Ignore junk files
        if p.name.lower() in ignore_files:
            continue

        # Ignore if path contains ignored dirs
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
# Code ZIP upload (project-based, no versions)
# ============================================================

def save_code_zip_and_extract(project: Project, uploaded_zip, uploader):
    """
    Save ZIP, extract into: media/projects/<project_id>/code/
    Index CodeFile rows, and log upload in ProjectFile.

    Behavior:
    - Stores the ZIP file under code folder (so you can audit it later)
    - Clears old extracted code folder content before extracting (prevents mixing old/new files)
    - Updates project.active_code pointer
    """
    code_root = Path(settings.MEDIA_ROOT) / "projects" / str(project.id) / "code"
    code_root.mkdir(parents=True, exist_ok=True)

    # OPTIONAL BUT RECOMMENDED:
    # Clear old extracted content (but keep folder)
    # This prevents stale files from previous zips staying around.
    for child in code_root.iterdir():
        try:
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
        except Exception:
            # If something is locked, we keep going (MVP friendly).
            pass

    # Save ZIP file into code root
    zip_path = code_root / uploaded_zip.name
    stored_zip_path = default_storage.save(str(zip_path), uploaded_zip)

    # Convert stored path to absolute path for extraction
    zip_full_path = Path(settings.MEDIA_ROOT) / stored_zip_path

    # Extract safely and index
    _safe_extract_zip(zip_full_path, code_root)
    _index_code_files(project, code_root, uploader)

    # Log upload
    pf = ProjectFile.objects.create(
        project=project,
        file_type="CODE",
        original_name=uploaded_zip.name,
        stored_path=str(code_root),  # store folder path for MVP
        uploaded_by=uploader,
    )

    # Mark as active Code ZIP
    project.active_code = pf
    project.save(update_fields=["active_code"])
    return pf
