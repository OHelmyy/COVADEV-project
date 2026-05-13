from __future__ import annotations

import json
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_POST, require_GET

from apps.projects.models import Project
from apps.task_management.models import TaskAssignment, DeveloperSubmission
from apps.accounts.rbac import is_evaluator, is_admin
from .permissions import can_open_project


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


# ── Evaluator: list all pending developer submissions ───────────────────────

@login_required
@require_GET
def api_dev_submissions_list(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not (is_admin(request.user) or (is_evaluator(request.user) and project.evaluator_id == request.user.id)):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    submissions = (
        DeveloperSubmission.objects
        .filter(project=project)
        .select_related("assignment__bpmn_task", "assignment__developer_membership__user")
        .order_by("-submitted_at")
    )

    return JsonResponse({
        "submissions": [
            {
                "id": s.id,
                "assignmentId": s.assignment.id,
                "taskId": s.assignment.bpmn_task.task_id,
                "taskName": s.assignment.bpmn_task.name,
                "developerEmail": s.assignment.developer_membership.user.email or s.assignment.developer_membership.user.username,
                "status": s.status,
                "attemptNumber": s.attempt_number,
                "feedback": s.feedback,
                "submittedAt": s.submitted_at.isoformat(),
                "reviewedAt": s.reviewed_at.isoformat() if s.reviewed_at else None,
                "zipUrl": f"/api/projects/{project.id}/developer-submissions/{s.id}/download/" if s.zip_file else None,
                "zipFileName": s.zip_file.name.split("/")[-1] if s.zip_file else None,
            }
            for s in submissions
        ]
    })


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

    import os
    from django.http import FileResponse
    filename = os.path.basename(submission.zip_file.name)
    return FileResponse(
        submission.zip_file.open("rb"),
        as_attachment=True,
        filename=filename,
    )