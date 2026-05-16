from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods, require_POST

from apps.analysis.models import AnalysisRun, BpmnTask, MatchResult
from apps.projects.models import Project, ProjectFile

from .permissions import can_open_project, is_project_evaluator, require_admin_or_evaluator
from apps.projects.github_service import validate_github_url
import json

@login_required
@require_http_methods(["GET"])
def api_project_logs(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not is_project_evaluator(project, request.user):
        return JsonResponse({"detail": "Only evaluator can view upload logs."}, status=403)

    logs = (
        ProjectFile.objects
        .filter(project=project)
        .select_related("uploaded_by")
        .order_by("-created_at")[:200]
    )

    return JsonResponse({
        "projectId": project.id,
        "logs": [
            {
                "id": f.id,
                "fileType": f.file_type,
                "originalName": f.original_name,
                "uploadedBy": f.uploaded_by.username if f.uploaded_by else None,
                "createdAt": f.created_at.isoformat() if f.created_at else None,
            }
            for f in logs
        ]
    })


@login_required
@require_POST
def api_update_threshold(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not is_project_evaluator(project, request.user):
        return JsonResponse({"detail": "Only evaluator can update settings."}, status=403)

    try:
        body = json.loads(request.body.decode("utf-8") or "{}")
        v = float(body.get("similarityThreshold") or 0)
        if v <= 0 or v >= 1:
            raise ValueError()
        project.similarity_threshold = v
        project.save(update_fields=["similarity_threshold"])
        return JsonResponse({"ok": True, "similarityThreshold": float(project.similarity_threshold)})
    except Exception:
        return JsonResponse({"detail": "Invalid threshold. Use 0..1 (e.g., 0.6)."}, status=400)

@login_required
@require_POST
def api_update_github_url(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not is_project_evaluator(project, request.user):
        return JsonResponse({"detail": "Only evaluator can update settings."}, status=403)

    try:
        body = json.loads(request.body.decode("utf-8") or "{}")
        url = (body.get("github_repo_url") or "").strip()

        if url:
            validate_github_url(url)

        project.github_repo_url = url
        project.save(update_fields=["github_repo_url"])
        return JsonResponse({"ok": True, "github_repo_url": project.github_repo_url})
    except ValueError as e:
        return JsonResponse({"detail": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"detail": f"Failed to update GitHub URL: {e}"}, status=400)

@login_required
def api_project_files(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    files = list(project.code_files.values("relative_path", "ext", "size_bytes"))
    return JsonResponse({"project_id": project.id, "files": files})


@login_required
def api_project_tasks(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    tasks = list(project.bpmn_tasks.values("task_id", "name", "description"))
    return JsonResponse({"project_id": project.id, "tasks": tasks})


@login_required
def api_project_matches(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    matches = []
    for m in project.match_results.select_related("task").all():
        matches.append({
            "status": m.status,
            "similarity_score": m.similarity_score,
            "task": {
                "task_id": m.task.task_id,
                "name": m.task.name,
            } if m.task else None,
            "code_ref": m.code_ref,
        })

    return JsonResponse({"project_id": project.id, "matches": matches})


@login_required
@require_http_methods(["GET"])
def api_project_report(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not require_admin_or_evaluator(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    tasks = list(BpmnTask.objects.filter(project=project).values("id", "task_id", "name"))

    matches = list(
        MatchResult.objects
        .filter(project=project)
        .select_related("task")
        .values(
            "id",
            "status",
            "similarity_score",
            "code_ref",
            "task__task_id",
            "task__name",
        )
    )

    traceability = []
    missingTasks = []
    extraCode = []

    matched_task_ids = set()

    for m in matches:
        status = str(m.get("status") or "").lower()
        task_id = m.get("task__task_id")
        task_name = m.get("task__name")

        if task_id and "missing" not in status and "extra" not in status:
            matched_task_ids.add(task_id)
            traceability.append({
                "taskId": task_id,
                "taskName": task_name or "",
                "bestMatch": m.get("code_ref") or "",
                "similarity": float(m.get("similarity_score") or 0.0),
                "developer": "-",
                "note": m.get("status") or "",
            })

        if "missing" in status and task_id:
            missingTasks.append({
                "taskId": task_id,
                "taskName": task_name or "",
                "reason": "Marked missing",
            })

        if (not task_id) or ("extra" in status):
            extraCode.append({
                "id": str(m.get("id")),
                "file": str(m.get("code_ref") or ""),
                "symbol": str(m.get("code_ref") or ""),
                "developer": "-",
                "reason": m.get("status") or "Extra",
            })

    already_missing_ids = {m["taskId"] for m in missingTasks}

    for t in tasks:
        if t["task_id"] not in matched_task_ids and t["task_id"] not in already_missing_ids:
            missingTasks.append({
                "taskId": t["task_id"],
                "taskName": t["name"] or "",
                "reason": "No match found",
            })

    return JsonResponse({
        "project": {"id": project.id, "name": project.name},
        "traceability": traceability,
        "missingTasks": missingTasks,
        "extraCode": extraCode,
    })