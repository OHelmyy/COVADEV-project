from __future__ import annotations

import json
import zipfile
import os
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_POST, require_GET
from apps.github_integration.models import GitHubRepository
from apps.github_integration.services.github_service import GitHubService
from apps.projects.models import Project
from apps.task_management.models import TaskAssignment, DeveloperSubmission
from apps.accounts.rbac import is_evaluator, is_admin
from .permissions import can_open_project
from apps.github_integration.models import GitHubRepository
from apps.github_integration.services.github_service import GitHubService
from apps.github_integration.views import _reindex_default_branch_async

# Text file extensions we'll try to display inline
TEXT_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".cpp", ".c", ".h",
    ".cs", ".go", ".rs", ".rb", ".php", ".html", ".css", ".scss",
    ".json", ".xml", ".yaml", ".yml", ".md", ".txt", ".sh", ".sql",
    ".env", ".toml", ".ini", ".cfg",
}
MAX_PREVIEW_BYTES = 100_000  # 100 KB limit per file preview


def _is_developer_of_project(project, user):
    from apps.projects.models import ProjectMembership
    return ProjectMembership.objects.filter(
        project=project, user=user, role="DEVELOPER"
    ).exists()


# ── Developer: list their assigned tasks + latest submission status ──────────

@login_required
@require_GET
def api_my_tasks(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    from apps.projects.models import ProjectMembership
    try:
        membership = ProjectMembership.objects.get(project=project, user=request.user)
    except ProjectMembership.DoesNotExist:
        return JsonResponse({"tasks": []})

    assignments = (
        TaskAssignment.objects
        .filter(project=project, developer_membership=membership)
        .select_related("bpmn_task")
        .prefetch_related("developer_submissions")
    )

    tasks = []
    for a in assignments:
        latest = a.developer_submissions.order_by("-submitted_at").first()
        tasks.append({
            "assignmentId": a.id,
            "taskId": a.bpmn_task.task_id,
            "taskName": a.bpmn_task.name,
            "taskDescription": a.bpmn_task.summary_text or a.bpmn_task.description or "",
            "assignmentStatus": a.status,
            "submission": {
                "id": latest.id,
                "status": latest.status,
                "attemptNumber": latest.attempt_number,
                "feedback": latest.feedback,
                "submittedAt": latest.submitted_at.isoformat(),
            } if latest else None,
        })

    return JsonResponse({"tasks": tasks})


# ── Developer: upload ZIP for an assignment ──────────────────────────────────

@login_required
@require_POST
def api_submit_zip(request, project_id: int, assignment_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    assignment = get_object_or_404(
        TaskAssignment, id=assignment_id, project=project
    )

    # Must be the assigned developer
    if assignment.developer_membership.user != request.user:
        return JsonResponse({"detail": "Not your assignment."}, status=403)

    # Block resubmit if already pending or accepted
    latest = assignment.developer_submissions.order_by("-submitted_at").first()
    if latest and latest.status == DeveloperSubmission.Status.PENDING:
        return JsonResponse({"detail": "Already submitted. Wait for review."}, status=400)
    if latest and latest.status == DeveloperSubmission.Status.ACCEPTED:
        return JsonResponse({"detail": "Already accepted."}, status=400)

    zip_file = request.FILES.get("zip_file")
    if not zip_file:
        return JsonResponse({"detail": "Missing zip_file."}, status=400)
    if not zip_file.name.endswith(".zip"):
        return JsonResponse({"detail": "Only .zip files are allowed."}, status=400)

    attempt = (latest.attempt_number + 1) if latest else 1

    submission = DeveloperSubmission.objects.create(
        assignment=assignment,
        project=project,
        zip_file=zip_file,
        attempt_number=attempt,
    )

    # Update assignment status
    assignment.status = TaskAssignment.Status.SUBMITTED
    assignment.submitted_at = timezone.now()
    assignment.save(update_fields=["status", "submitted_at"])

    return JsonResponse({
        "ok": True,
        "submissionId": submission.id,
        "attemptNumber": submission.attempt_number,
    })


# ── Evaluator: list all developer submissions grouped by assignment ──────────

@login_required
@require_GET
def api_dev_submissions_list(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not (is_admin(request.user) or (is_evaluator(request.user) and project.evaluator_id == request.user.id)):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    # Fetch all submissions ordered newest first
    submissions = (
        DeveloperSubmission.objects
        .filter(project=project)
        .select_related("assignment__bpmn_task", "assignment__developer_membership__user")
        .order_by("assignment_id", "-attempt_number")
    )

    # Fetch similarity scores from MatchResult for developer submissions
    from apps.analysis.models import MatchResult
    match_scores: dict[str, float] = {}
    for mr in MatchResult.objects.filter(project=project, is_ai_generated=False):
        if mr.code_ref and mr.code_ref.startswith("Developer submission"):
            # code_ref format: "Developer submission #<id>"
            try:
                sub_id = int(mr.code_ref.split("#")[-1])
                match_scores[sub_id] = round(mr.similarity_score, 3)
            except (ValueError, IndexError):
                pass

    # Group submissions by assignment
    from collections import defaultdict
    grouped: dict[int, list] = defaultdict(list)
    assignment_meta: dict[int, dict] = {}

    for s in submissions:
        a = s.assignment
        aid = a.id
        if aid not in assignment_meta:
            assignment_meta[aid] = {
                "assignmentId": aid,
                "taskId": a.bpmn_task.task_id,
                "taskName": a.bpmn_task.name,
                "taskDescription": a.bpmn_task.summary_text or a.bpmn_task.description or "",
                "developerEmail": a.developer_membership.user.email or a.developer_membership.user.username,
                "developerName": (
                    f"{a.developer_membership.user.first_name} {a.developer_membership.user.last_name}".strip()
                    or a.developer_membership.user.username
                ),
                "assignmentStatus": a.status,
            }
        grouped[aid].append({
            "id": s.id,
            "status": s.status,
            "attemptNumber": s.attempt_number,
            "feedback": s.feedback,
            "submittedAt": s.submitted_at.isoformat(),
            "reviewedAt": s.reviewed_at.isoformat() if s.reviewed_at else None,
            "reviewedBy": s.reviewed_by.email if s.reviewed_by else None,
            "zipUrl": f"/api/projects/{project.id}/developer-submissions/{s.id}/download/" if s.zip_file else None,
            "zipFileName": s.zip_file.name.split("/")[-1] if s.zip_file else None,
            "hasFiles": bool(s.zip_file),
            "similarityScore": match_scores.get(s.id),
        })

    # Build final list — each entry is one assignment with all its attempts
    result = []
    for aid, meta in assignment_meta.items():
        attempts = grouped[aid]  # already sorted newest first
        latest = attempts[0]
        result.append({
            **meta,
            "latestStatus": latest["status"],
            "totalAttempts": len(attempts),
            "attempts": attempts,
        })

    # Sort: pending first, then by latest submission time
    result.sort(key=lambda x: (
        0 if x["latestStatus"] == "PENDING" else 1,
        x["attempts"][0]["submittedAt"] if x["attempts"] else "",
    ), reverse=False)
    # Reverse the time sort within groups so newest pending is on top
    pending = [r for r in result if r["latestStatus"] == "PENDING"]
    reviewed = [r for r in result if r["latestStatus"] != "PENDING"]
    pending.sort(key=lambda x: x["attempts"][0]["submittedAt"] if x["attempts"] else "", reverse=True)
    reviewed.sort(key=lambda x: x["attempts"][0]["submittedAt"] if x["attempts"] else "", reverse=True)

    return JsonResponse({"submissions": pending + reviewed})


# ── Evaluator: accept ────────────────────────────────────────────────────────

@login_required
@require_POST
def api_dev_submission_accept(request, project_id: int, submission_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not (is_admin(request.user) or (is_evaluator(request.user) and project.evaluator_id == request.user.id)):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    submission = get_object_or_404(DeveloperSubmission, id=submission_id, project=project)

    if submission.status != DeveloperSubmission.Status.PENDING:
        return JsonResponse({"detail": "Submission is not pending."}, status=400)

    try:
        from apps.task_management.services.developer_match_service import match_accepted_developer_submission
        result = match_accepted_developer_submission(submission)
    except Exception as e:
        return JsonResponse({"detail": f"Pipeline failed: {e}"}, status=500)

    # Score below threshold — warn evaluator, keep as PENDING
    if result and result["below_threshold"]:
        return JsonResponse({
            "ok": False,
            "belowThreshold": True,
            "similarity": round(result["similarity"], 3),
            "threshold": result["threshold"],
            "detail": (
                f"Code similarity score ({result['similarity']:.2f}) is below "
                f"the threshold ({result['threshold']:.2f}). "
                f"Submission remains Pending. Please reject with feedback or reassign."
            ),
        }, status=200)

    # Score meets threshold — accept
    submission.status = DeveloperSubmission.Status.ACCEPTED
    submission.reviewed_at = timezone.now()
    submission.reviewed_by = request.user
    submission.feedback = ""
    submission.save()

    submission.assignment.status = TaskAssignment.Status.ACCEPTED
    submission.assignment.reviewed_at = timezone.now()
    submission.assignment.reviewed_by = request.user
    submission.assignment.save(update_fields=["status", "reviewed_at", "reviewed_by"])

    return JsonResponse({
        "ok": True,
        "similarity": result["similarity"] if result else None,
        "matchStatus": result["match"].status if result else None,
    })

# ── Evaluator: reject ────────────────────────────────────────────────────────

@login_required
@require_POST
def api_dev_submission_reject(request, project_id: int, submission_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not (is_admin(request.user) or (is_evaluator(request.user) and project.evaluator_id == request.user.id)):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    submission = get_object_or_404(DeveloperSubmission, id=submission_id, project=project)
    if submission.status != DeveloperSubmission.Status.PENDING:
        return JsonResponse({"detail": "Submission is not pending."}, status=400)

    body = json.loads(request.body.decode() or "{}")
    feedback = (body.get("feedback") or "").strip()

    submission.status = DeveloperSubmission.Status.REJECTED
    submission.reviewed_at = timezone.now()
    submission.reviewed_by = request.user
    submission.feedback = feedback
    submission.save()

    submission.assignment.status = TaskAssignment.Status.REJECTED
    submission.assignment.reviewed_at = timezone.now()
    submission.assignment.reviewed_by = request.user
    submission.assignment.save(update_fields=["status", "reviewed_at", "reviewed_by"])

    return JsonResponse({"ok": True})


# ── Evaluator: reassign ──────────────────────────────────────────────────────

@login_required
@require_POST
def api_dev_submission_reassign(request, project_id: int, submission_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not (is_admin(request.user) or (is_evaluator(request.user) and project.evaluator_id == request.user.id)):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    submission = get_object_or_404(DeveloperSubmission, id=submission_id, project=project)
    if submission.status not in (
        DeveloperSubmission.Status.PENDING,
        DeveloperSubmission.Status.ACCEPTED,
    ):
        return JsonResponse({"detail": "Cannot reassign this submission."}, status=400)

    # If previously accepted, remove the existing match result so it reopens cleanly
    if submission.status == DeveloperSubmission.Status.ACCEPTED:
        from apps.analysis.models import MatchResult
        MatchResult.objects.filter(
            project=project,
            task=submission.assignment.bpmn_task,
            is_ai_generated=False,
            code_ref__startswith="Developer submission",
        ).delete()

        
    body = json.loads(request.body.decode() or "{}")
    feedback = (body.get("feedback") or "").strip()
    if not feedback:
        return JsonResponse({"detail": "Feedback is required for reassignment."}, status=400)

    submission.status = DeveloperSubmission.Status.REASSIGNED
    submission.reviewed_at = timezone.now()
    submission.reviewed_by = request.user
    submission.feedback = feedback
    submission.save()

    submission.assignment.status = TaskAssignment.Status.ASSIGNED
    submission.assignment.reviewed_at = timezone.now()
    submission.assignment.reviewed_by = request.user
    submission.assignment.save(update_fields=["status", "reviewed_at", "reviewed_by"])

    return JsonResponse({"ok": True})

# ── Evaluator: download ZIP ──────────────────────────────────────────────────

@login_required
def api_dev_submission_download(request, project_id: int, submission_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not (is_admin(request.user) or (is_evaluator(request.user) and project.evaluator_id == request.user.id)):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    submission = get_object_or_404(DeveloperSubmission, id=submission_id, project=project)

    if not submission.zip_file:
        return JsonResponse({"detail": "No file attached."}, status=404)

    from django.http import FileResponse
    filename = os.path.basename(submission.zip_file.name)
    return FileResponse(
        submission.zip_file.open("rb"),
        as_attachment=True,
        filename=filename,
    )


# ── Evaluator: list files inside a submission ZIP ───────────────────────────

@login_required
@require_GET
def api_dev_submission_file_tree(request, project_id: int, submission_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not (is_admin(request.user) or (is_evaluator(request.user) and project.evaluator_id == request.user.id)):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    submission = get_object_or_404(DeveloperSubmission, id=submission_id, project=project)

    if not submission.zip_file:
        return JsonResponse({"detail": "No file attached."}, status=404)

    try:
        with zipfile.ZipFile(submission.zip_file.path, "r") as zf:
            all_names = [info.filename for info in zf.infolist() if not info.is_dir()]
    except Exception as e:
        return JsonResponse({"detail": f"Could not read zip: {e}"}, status=500)

    # Build a nested tree structure
    def build_tree(paths):
        tree = {}
        for path in sorted(paths):
            parts = path.replace("\\", "/").split("/")
            node = tree
            for i, part in enumerate(parts):
                if i == len(parts) - 1:
                    # It's a file
                    ext = os.path.splitext(part)[1].lower()
                    node[part] = {
                        "type": "file",
                        "path": path,
                        "name": part,
                        "previewable": ext in TEXT_EXTENSIONS,
                    }
                else:
                    if part not in node:
                        node[part] = {"type": "dir", "name": part, "children": {}}
                    node = node[part]["children"]
        return tree

    tree = build_tree(all_names)

    return JsonResponse({
        "submissionId": submission_id,
        "totalFiles": len(all_names),
        "tree": tree,
    })


# ── Evaluator: get content of a specific file inside a submission ZIP ────────

@login_required
@require_GET
def api_dev_submission_file_content(request, project_id: int, submission_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not (is_admin(request.user) or (is_evaluator(request.user) and project.evaluator_id == request.user.id)):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    submission = get_object_or_404(DeveloperSubmission, id=submission_id, project=project)

    if not submission.zip_file:
        return JsonResponse({"detail": "No file attached."}, status=404)

    file_path = request.GET.get("path", "").strip()
    if not file_path:
        return JsonResponse({"detail": "Missing 'path' query param."}, status=400)

    ext = os.path.splitext(file_path)[1].lower()
    if ext not in TEXT_EXTENSIONS:
        return JsonResponse({"detail": "File type not previewable."}, status=400)

    try:
        with zipfile.ZipFile(submission.zip_file.path, "r") as zf:
            # Normalize path separators
            names = zf.namelist()
            normalized = {n.replace("\\", "/"): n for n in names}
            lookup = file_path.replace("\\", "/")
            actual_name = normalized.get(lookup)
            if not actual_name:
                return JsonResponse({"detail": "File not found in zip."}, status=404)
            raw = zf.read(actual_name)
            if len(raw) > MAX_PREVIEW_BYTES:
                raw = raw[:MAX_PREVIEW_BYTES]
                truncated = True
            else:
                truncated = False
            try:
                content = raw.decode("utf-8")
            except UnicodeDecodeError:
                content = raw.decode("latin-1")
    except Exception as e:
        return JsonResponse({"detail": f"Could not read file: {e}"}, status=500)

    return JsonResponse({
        "path": file_path,
        "content": content,
        "truncated": truncated,
        "language": ext.lstrip("."),
    })

# ── Evaluator: accept GitHub PR ──────────────────────────────────────────────

@login_required
@require_POST
def api_github_pr_accept(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not (is_admin(request.user) or (is_evaluator(request.user) and project.evaluator_id == request.user.id)):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    try:
        import json as _json
        body = _json.loads(request.body)
    except Exception:
        return JsonResponse({"detail": "Invalid JSON."}, status=400)

    pr_number = body.get("pr_number")
    commit_title = body.get("commit_title") or ""
    commit_message = body.get("commit_message") or ""

    if not pr_number:
        return JsonResponse({"detail": "pr_number is required."}, status=400)

    # Auto-find assignment by matching PR author to developer in this project
   
    try:
        github_repo = GitHubRepository.objects.get(project=project)
        service = GitHubService(token=github_repo.access_token)
        pr_data = service.get_pull_request(github_repo.owner, github_repo.repo_name, int(pr_number))
        pr_author = pr_data.get("user", {}).get("login", "").lower()
    except Exception as e:
        return JsonResponse({"detail": f"Could not fetch PR: {e}"}, status=500)

    pr_branch = pr_data.get("head", {}).get("ref", "")

    # Match by branch name first (most reliable)
    assignment = TaskAssignment.objects.filter(
        project=project,
        github_branch=pr_branch,
    ).exclude(status__in=["ACCEPTED", "MERGED"]).first()

    # Fallback: match by GitHub username
    if not assignment:
        assignment = TaskAssignment.objects.filter(
            project=project,
            developer_membership__user__username__iexact=pr_author,
        ).exclude(status__in=["ACCEPTED", "MERGED"]).first()

    if not assignment:
        return JsonResponse(
            {"detail": f"No active assignment found for branch '{pr_branch}' or user '{pr_author}' in this project."},
            status=404,
        )
    # Run the similarity pipeline
    try:
        from apps.task_management.services.developer_match_service import match_accepted_github_submission
        result = match_accepted_github_submission(project, assignment, int(pr_number))
    except Exception as e:
        return JsonResponse({"detail": f"Pipeline failed: {e}"}, status=500)

    # Below threshold — warn evaluator, do not merge
    if result and result["below_threshold"]:
        return JsonResponse({
            "ok": False,
            "belowThreshold": True,
            "similarity": round(result["similarity"], 3),
            "threshold": result["threshold"],
            "detail": (
                f"Code similarity score ({result['similarity']:.2f}) is below "
                f"the threshold ({result['threshold']:.2f}). "
                f"Submission remains Pending. Please reject with feedback or reassign."
            ),
        }, status=200)

    # Above threshold — merge the PR
    try:
        service = GitHubService(token=github_repo.access_token)
        service.merge_pull_request(
            github_repo.owner,
            github_repo.repo_name,
            int(pr_number),
            commit_title=commit_title or None,
            commit_message=commit_message or None,
        )
        _reindex_default_branch_async(service, github_repo, project_id, request.user)
    except Exception as e:
        return JsonResponse({"detail": f"Merge failed: {e}"}, status=500)

    # Mark assignment as ACCEPTED
    assignment.status = TaskAssignment.Status.ACCEPTED
    assignment.reviewed_at = timezone.now()
    assignment.reviewed_by = request.user
    assignment.github_pr_number = int(pr_number)
    assignment.save(update_fields=["status", "reviewed_at", "reviewed_by", "github_pr_number", "updated_at"])

    return JsonResponse({
        "ok": True,
        "similarity": result["similarity"] if result else None,
        "matchStatus": result["match"].status if result else None,
    })