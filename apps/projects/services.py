import zipfile
from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage

from .models import Project, UploadVersion, ProjectFile, CodeFile


def create_project(user, name, description=""):
    return Project.objects.create(
        name=name,
        description=description,
        created_by=user,
    )


def create_new_version(project):
    last_version = project.versions.first()
    next_number = 1 if not last_version else last_version.version_number + 1
    return UploadVersion.objects.create(
        project=project,
        version_number=next_number,
    )


def save_bpmn_file(version, uploaded_file):
    project_dir = Path(settings.MEDIA_ROOT) / "projects" / str(version.project.id) / "bpmn" / f"v{version.version_number}"
    project_dir.mkdir(parents=True, exist_ok=True)

    file_path = project_dir / uploaded_file.name
    stored_path = default_storage.save(str(file_path), uploaded_file)

    return ProjectFile.objects.create(
        version=version,
        file_type="BPMN",
        original_name=uploaded_file.name,
        stored_path=stored_path,
    )


def _safe_extract_zip(zip_file_path: Path, extract_to: Path):
    """
    Prevent zip slip (../) attacks and extract safely.
    """
    with zipfile.ZipFile(zip_file_path, "r") as zf:
        for member in zf.infolist():
            member_path = Path(member.filename)

            # skip directories
            if member.is_dir():
                continue

            # zip slip protection
            resolved = (extract_to / member_path).resolve()
            if not str(resolved).startswith(str(extract_to.resolve())):
                raise ValueError("Unsafe zip content (path traversal detected).")

        zf.extractall(extract_to)


def _index_code_files(version: UploadVersion, code_root_dir: Path):
    """
    Scan extracted directory and store file list in CodeFile table.
    """
    CodeFile.objects.filter(version=version).delete()

    for p in code_root_dir.rglob("*"):
        if not p.is_file():
            continue

        # ignore common junk
        name = p.name.lower()
        if name in {".ds_store"}:
            continue
        if p.parts and any(part.lower() in {"__pycache__", ".git", "node_modules", "venv"} for part in p.parts):
            continue

        rel = p.relative_to(code_root_dir).as_posix()
        ext = p.suffix.lower().lstrip(".")  # "py", "js", ...
        size = p.stat().st_size

        CodeFile.objects.create(
            version=version,
            relative_path=rel,
            ext=ext,
            size_bytes=size,
        )


def save_code_zip_and_extract(version, uploaded_zip):
    code_root = Path(settings.MEDIA_ROOT) / "projects" / str(version.project.id) / "code" / f"v{version.version_number}"
    code_root.mkdir(parents=True, exist_ok=True)

    zip_path = code_root / uploaded_zip.name
    stored_zip_path = default_storage.save(str(zip_path), uploaded_zip)

    zip_full_path = Path(settings.MEDIA_ROOT) / stored_zip_path

    # Extract safely
    _safe_extract_zip(zip_full_path, code_root)

    # Index extracted files
    _index_code_files(version, code_root)

    return ProjectFile.objects.create(
        version=version,
        file_type="CODE",
        original_name=uploaded_zip.name,
        stored_path=str(code_root),  # store folder
    )
