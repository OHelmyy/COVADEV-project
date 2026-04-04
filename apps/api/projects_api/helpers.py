from __future__ import annotations

from apps.projects.models import Project, ProjectFile


def latest_file(project: Project, file_type: str):
    return (
        ProjectFile.objects
        .filter(project=project, file_type=file_type)
        .select_related("uploaded_by")
        .order_by("-created_at")
        .first()
    )


def get_project_bpmn_summary(project: Project) -> str:
    # 1) active BPMN file
    f = getattr(project, "active_bpmn", None)
    if f and hasattr(f, "bpmn_summary"):
        return (f.bpmn_summary or "").strip()

    # 2) latest BPMN file
    latest = latest_file(project, "BPMN")
    if latest and hasattr(latest, "bpmn_summary"):
        return (latest.bpmn_summary or "").strip()

    # 3) fallback
    if hasattr(project, "bpmn_summary"):
        return (project.bpmn_summary or "").strip()

    return ""