from __future__ import annotations

from django.contrib.auth.models import User

from apps.accounts.rbac import is_admin, is_evaluator
from apps.analysis.models import AnalysisRun, BpmnTask, MatchResult
from apps.projects.models import Project, ProjectMembership, CodeFile

from .helpers import latest_file


def json_project_summary(project: Project, user: User):
    if is_admin(user):
        role = "ADMIN"
    elif getattr(project, "evaluator_id", None) == user.id and is_evaluator(user):
        role = "EVALUATOR"
    elif ProjectMembership.objects.filter(project=project, user=user).exists():
        role = "DEVELOPER"
    else:
        role = None

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description or "",
        "similarityThreshold": float(project.similarity_threshold),
        "membership": {"role": role} if role else None,
    }


def json_file_payload(f):
    if not f:
        return None

    payload = {
        "id": f.id,
        "originalName": f.original_name,
        "createdAt": f.created_at.isoformat() if f.created_at else None,
        "uploadedBy": f.uploaded_by.username if f.uploaded_by else None,
        "fileType": getattr(f, "file_type", None),
    }

    if getattr(f, "file_type", None) == "BPMN":
        raw_is_well_formed = getattr(f, "is_well_formed", None)
        payload["isWellFormed"] = raw_is_well_formed if isinstance(raw_is_well_formed, bool) else None
        payload["precheckWarnings"] = getattr(f, "precheck_warnings", []) or []
        payload["precheckErrors"] = getattr(f, "precheck_errors", []) or []
        payload["bpmnSummary"] = getattr(f, "bpmn_summary", "") or ""

    return payload


def json_project_detail(project: Project, user: User):
    active_bpmn = project.active_bpmn
    active_code = project.active_code

    latest_bpmn = latest_file(project, "BPMN")
    latest_code = latest_file(project, "CODE")

    code_files_count = CodeFile.objects.filter(project=project).count()
    tasks_count = BpmnTask.objects.filter(project=project).count()
    matches_count = MatchResult.objects.filter(project=project).count()

    runs = AnalysisRun.objects.filter(project=project).order_by("-created_at")[:10]

    members = (
        ProjectMembership.objects
        .select_related("user")
        .filter(project=project)
        .order_by("user__username")
    )

    if is_admin(user):
        my_role = "ADMIN"
    elif getattr(project, "evaluator_id", None) == user.id and is_evaluator(user):
        my_role = "EVALUATOR"
    else:
        my_role = "DEVELOPER"

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description or "",
            "similarityThreshold": float(project.similarity_threshold),
            "evaluator": {
                "id": project.evaluator_id,
                "username": project.evaluator.username if getattr(project, "evaluator", None) else None,
                "email": project.evaluator.email if getattr(project, "evaluator", None) else None,
            } if getattr(project, "evaluator_id", None) else None,
        },
        "membership": {"role": my_role},
        "activeUploads": {
            "activeBpmn": json_file_payload(active_bpmn),
            "activeCode": json_file_payload(active_code),
            "latestBpmn": json_file_payload(latest_bpmn),
            "latestCode": json_file_payload(latest_code),
        },
        "counts": {
            "codeFiles": code_files_count,
            "tasks": tasks_count,
            "matches": matches_count,
        },
        "runs": [
            {
                "id": r.id,
                "status": r.status,
                "startedAt": r.started_at.isoformat() if r.started_at else None,
                "finishedAt": r.finished_at.isoformat() if r.finished_at else None,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
                "errorMessage": r.error_message,
            }
            for r in runs
        ],
        "members": [
            {
                "id": m.id,
                "username": m.user.username,
                "email": m.user.email,
                "role": getattr(m, "role", "DEVELOPER"),
            }
            for m in members
        ],
    }