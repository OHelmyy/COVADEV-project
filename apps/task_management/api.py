from __future__ import annotations

import json
from django.utils import timezone
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST
from django.core.exceptions import ValidationError

from apps.projects.models import Project, ProjectMembership
from apps.analysis.models import BpmnTask
from apps.task_management.models import TaskAssignment, TaskEvaluation
from apps.task_management.permissions import (
    can_assign_tasks,
    can_review_tasks,
    can_view_assignment,
)
from apps.task_management.services.assignment_service import (
    assign_task,
    submit_assignment,
    review_assignment,
)
from apps.accounts.rbac import is_admin, is_evaluator
from apps.task_management.services.evaluation_service import evaluate_assignment


def _parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return {}


def _serialize_assignment(assignment: TaskAssignment) -> dict:
    membership = assignment.developer_membership
    user = membership.user
    task = assignment.bpmn_task

    return {
        "assignmentId": assignment.id,
        "projectId": assignment.project_id,
        "status": assignment.status,
        "assignmentNotes": assignment.assignment_notes,
        "submissionNotes": assignment.submission_notes,
        "reviewNotes": assignment.review_notes,
        "assignedAt": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
        "startedAt": assignment.started_at.isoformat() if assignment.started_at else None,
        "submittedAt": assignment.submitted_at.isoformat() if assignment.submitted_at else None,
        "reviewedAt": assignment.reviewed_at.isoformat() if assignment.reviewed_at else None,
        "assignedBy": {
            "id": assignment.assigned_by.id,
            "username": assignment.assigned_by.username,
        } if assignment.assigned_by else None,
        "reviewedBy": {
            "id": assignment.reviewed_by.id,
            "username": assignment.reviewed_by.username,
        } if assignment.reviewed_by else None,
        "task": {
            "id": task.id,
            "taskId": task.task_id,
            "name": task.name,
            "description": task.description,
        },
        "developer": {
            "membershipId": membership.id,
            "userId": user.id,
            "username": user.username,
            "email": user.email,
            "role": membership.role,
        },
        "evaluation": _serialize_evaluation(getattr(assignment, "evaluation", None)),
    }


def _serialize_evaluation(evaluation):
    if not evaluation:
        return None

    return {
        "id": evaluation.id,
        "evaluator": {
            "id": evaluation.evaluator.id,
            "username": evaluation.evaluator.username,
        } if evaluation.evaluator else None,
        "correctnessScore": float(evaluation.correctness_score),
        "qualityScore": float(evaluation.quality_score),
        "timelinessScore": float(evaluation.timeliness_score),
        "communicationScore": float(evaluation.communication_score),
        "finalScore": float(evaluation.final_score),
        "comments": evaluation.comments,
        "evaluatedAt": evaluation.evaluated_at.isoformat() if evaluation.evaluated_at else None,
    }

@login_required
@require_GET
def project_developers_api(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    memberships = (
        ProjectMembership.objects
        .select_related("user")
        .filter(project=project, role="DEVELOPER")
        .order_by("user__username")
    )

    data = [
        {
            "membershipId": m.id,
            "userId": m.user.id,
            "username": m.user.username,
            "email": m.user.email,
            "role": m.role,
        }
        for m in memberships
    ]

    return JsonResponse({
        "projectId": project.id,
        "developers": data,
    })


@login_required
@require_GET
def project_task_assignments_api(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    tasks = list(
        BpmnTask.objects.filter(project=project).order_by("id")
    )

    assignments = {
        a.bpmn_task_id: a
        for a in TaskAssignment.objects.select_related(
            "developer_membership__user",
            "assigned_by",
            "reviewed_by",
            "bpmn_task",
        ).filter(project=project)
    }

    result = []
    for task in tasks:
        assignment = assignments.get(task.id)
        result.append({
            "task": {
                "id": task.id,
                "taskId": task.task_id,
                "name": task.name,
                "description": task.description,
            },
            "assignment": _serialize_assignment(assignment) if assignment else None,
        })

    return JsonResponse({
        "projectId": project.id,
        "items": result,
    })


@login_required
@require_POST
def assign_task_api(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    # Permission check
    if not can_assign_tasks(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    # Parse request body
    body = _parse_json_body(request)
    bpmn_task_id = body.get("bpmnTaskId")
    developer_membership_id = body.get("developerMembershipId")
    notes = body.get("notes", "")

    # Validate required fields
    if not bpmn_task_id or not developer_membership_id:
        return JsonResponse(
            {"detail": "bpmnTaskId and developerMembershipId are required."},
            status=400,
        )

    # Call service with error handling
    try:
        assignment = assign_task(
            project=project,
            bpmn_task_id=bpmn_task_id,
            developer_membership_id=developer_membership_id,
            assigned_by=request.user,
            notes=notes,
        )
    except ValidationError as e:
        return JsonResponse(
            {"detail": str(e)},
            status=400,
        )
    except Exception as e:
        # Catch unexpected errors (very important for debugging)
        return JsonResponse(
            {"detail": f"Unexpected error: {str(e)}"},
            status=500,
        )

    # Success response
    return JsonResponse(
        {
            "message": "Task assigned successfully.",
            "assignment": _serialize_assignment(assignment),
        },
        status=201,
    )


@login_required
@require_POST
def submit_task_assignment_api(request, assignment_id: int):
    assignment = get_object_or_404(
        TaskAssignment.objects.select_related("developer_membership__user", "project"),
        id=assignment_id
    )

    if assignment.developer_membership.user_id != request.user.id and not is_admin(request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    body = _parse_json_body(request)
    submission_notes = body.get("submissionNotes", "")

    assignment = submit_assignment(
        assignment=assignment,
        submission_notes=submission_notes,
    )

    return JsonResponse({
        "message": "Assignment submitted successfully.",
        "assignment": _serialize_assignment(assignment),
    })


def start_assignment(*, assignment):
    if assignment.status == TaskAssignment.Status.ASSIGNED:
        assignment.status = TaskAssignment.Status.IN_PROGRESS
        assignment.started_at = timezone.now()
        assignment.save()
    return assignment


@login_required
@require_POST
def review_task_assignment_api(request, assignment_id: int):
    assignment = get_object_or_404(
        TaskAssignment.objects.select_related("project"),
        id=assignment_id
    )

    if not can_review_tasks(assignment.project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    body = _parse_json_body(request)
    accepted = body.get("accepted")
    review_notes = body.get("reviewNotes", "")

    if accepted is None:
        return JsonResponse({"detail": "accepted is required."}, status=400)

    assignment = review_assignment(
        assignment=assignment,
        reviewed_by=request.user,
        accepted=bool(accepted),
        review_notes=review_notes,
    )

    return JsonResponse({
        "message": "Assignment reviewed successfully.",
        "assignment": _serialize_assignment(assignment),
    })



@login_required
@require_GET
def my_task_assignments_api(request):
    assignments = (
        TaskAssignment.objects
        .select_related("bpmn_task", "project")
        .filter(developer_membership__user=request.user)
        .order_by("-assigned_at")
    )

    data = [
        _serialize_assignment(a)
        for a in assignments
    ]

    return JsonResponse({
        "items": data
    })

@login_required
@require_POST
def start_task_assignment_api(request, assignment_id: int):
    assignment = get_object_or_404(TaskAssignment, id=assignment_id)

    if assignment.developer_membership.user_id != request.user.id:
        return JsonResponse({"detail": "Forbidden"}, status=403)

    assignment = start_assignment(assignment=assignment)

    return JsonResponse({
        "assignment": _serialize_assignment(assignment)
    })


@login_required
@require_POST
def evaluate_task_assignment_api(request, assignment_id: int):
    assignment = get_object_or_404(
        TaskAssignment.objects.select_related("project"),
        id=assignment_id
    )

    if not can_review_tasks(assignment.project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    body = _parse_json_body(request)

    try:
        correctness_score = body.get("correctnessScore")
        quality_score = body.get("qualityScore")
        timeliness_score = body.get("timelinessScore")
        communication_score = body.get("communicationScore")
        comments = body.get("comments", "")

        if correctness_score is None or quality_score is None or timeliness_score is None or communication_score is None:
            return JsonResponse({"detail": "All score fields are required."}, status=400)

        evaluation = evaluate_assignment(
            assignment_id=assignment.id,
            evaluator=request.user,
            correctness_score=correctness_score,
            quality_score=quality_score,
            timeliness_score=timeliness_score,
            communication_score=communication_score,
            comments=comments,
        )
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=400)

    return JsonResponse({
        "message": "Task evaluated successfully.",
        "evaluation": _serialize_evaluation(evaluation),
    }, status=201)


from django.db.models import Count, Avg, Q

@login_required
@require_GET
def project_developer_performance_api(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)

    if not can_review_tasks(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    developer_memberships = (
        ProjectMembership.objects
        .select_related("user")
        .filter(project=project, role="DEVELOPER")
    )

    items = []
    for membership in developer_memberships:
        assignments = TaskAssignment.objects.filter(
            project=project,
            developer_membership=membership
        )

        total_assigned = assignments.count()
        accepted_count = assignments.filter(status=TaskAssignment.Status.ACCEPTED).count()
        rejected_count = assignments.filter(status=TaskAssignment.Status.REJECTED).count()
        submitted_count = assignments.filter(status=TaskAssignment.Status.SUBMITTED).count()
        in_progress_count = assignments.filter(status=TaskAssignment.Status.IN_PROGRESS).count()

        evaluations = TaskEvaluation.objects.filter(assignment__in=assignments)
        avg_final_score = evaluations.aggregate(avg=Avg("final_score"))["avg"] or 0

        acceptance_rate = (accepted_count / total_assigned * 100) if total_assigned else 0

        items.append({
            "membershipId": membership.id,
            "userId": membership.user.id,
            "username": membership.user.username,
            "email": membership.user.email,
            "totalAssigned": total_assigned,
            "acceptedCount": accepted_count,
            "rejectedCount": rejected_count,
            "submittedCount": submitted_count,
            "inProgressCount": in_progress_count,
            "acceptanceRate": round(acceptance_rate, 2),
            "averageScore": round(float(avg_final_score), 2),
        })

    items.sort(key=lambda x: (-x["averageScore"], -x["acceptedCount"], x["username"].lower()))

    return JsonResponse({
        "projectId": project.id,
        "items": items,
    })


    



@login_required
@require_GET
def developer_performance_overview_api(request):
    user = request.user

    if not (is_admin(user) or is_evaluator(user)):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if is_admin(user):
        memberships = (
            ProjectMembership.objects
            .select_related("user", "project")
            .filter(role="DEVELOPER")
        )
    else:
        memberships = (
            ProjectMembership.objects
            .select_related("user", "project")
            .filter(role="DEVELOPER", project__evaluator_id=user.id)
        )

    developer_map = {}

    for membership in memberships:
        dev_user = membership.user

        if dev_user.id not in developer_map:
            developer_map[dev_user.id] = {
                "userId": dev_user.id,
                "username": dev_user.username,
                "email": dev_user.email,
                "projects": set(),
                "totalAssigned": 0,
                "acceptedCount": 0,
                "rejectedCount": 0,
                "submittedCount": 0,
                "inProgressCount": 0,
                "evaluationScores": [],
            }

        entry = developer_map[dev_user.id]
        entry["projects"].add(membership.project_id)

        assignments = TaskAssignment.objects.filter(developer_membership=membership)

        entry["totalAssigned"] += assignments.count()
        entry["acceptedCount"] += assignments.filter(
            status=TaskAssignment.Status.ACCEPTED
        ).count()
        entry["rejectedCount"] += assignments.filter(
            status=TaskAssignment.Status.REJECTED
        ).count()
        entry["submittedCount"] += assignments.filter(
            status=TaskAssignment.Status.SUBMITTED
        ).count()
        entry["inProgressCount"] += assignments.filter(
            status=TaskAssignment.Status.IN_PROGRESS
        ).count()

        evaluations = TaskEvaluation.objects.filter(assignment__in=assignments)
        entry["evaluationScores"].extend(
            list(evaluations.values_list("final_score", flat=True))
        )

    items = []
    for entry in developer_map.values():
        total_assigned = entry["totalAssigned"]
        accepted_count = entry["acceptedCount"]

        average_score = (
            round(
                sum(float(score) for score in entry["evaluationScores"])
                / len(entry["evaluationScores"]),
                2,
            )
            if entry["evaluationScores"]
            else 0.0
        )

        acceptance_rate = (
            round((accepted_count / total_assigned) * 100, 2)
            if total_assigned
            else 0.0
        )

        items.append({
            "userId": entry["userId"],
            "username": entry["username"],
            "email": entry["email"],
            "projectsCount": len(entry["projects"]),
            "totalAssigned": total_assigned,
            "acceptedCount": entry["acceptedCount"],
            "rejectedCount": entry["rejectedCount"],
            "submittedCount": entry["submittedCount"],
            "inProgressCount": entry["inProgressCount"],
            "acceptanceRate": acceptance_rate,
            "averageScore": average_score,
        })

    items.sort(
        key=lambda x: (-x["averageScore"], -x["acceptedCount"], x["username"].lower())
    )

    return JsonResponse({"items": items})