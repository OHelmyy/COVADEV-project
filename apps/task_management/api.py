from __future__ import annotations

import json
from django.utils import timezone
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST
from django.core.exceptions import ValidationError
from django.db.models import Count, Avg, Q
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
    start_assignment,
)
from apps.accounts.rbac import is_admin, is_evaluator
from apps.task_management.services.evaluation_service import evaluate_assignment, auto_evaluate_assignment
from apps.task_management.models import TaskAssignment, TaskEvaluation, Notification

def _parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return {}

def _serialize_notification(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "type": notification.type,
        "title": notification.title,
        "message": notification.message,
        "isRead": notification.is_read,
        "readAt": notification.read_at.isoformat() if notification.read_at else None,
        "createdAt": notification.created_at.isoformat() if notification.created_at else None,
        "project": {
            "id": notification.project.id,
            "name": getattr(notification.project, "name", f"Project #{notification.project.id}"),
        } if notification.project else None,
        "assignmentId": notification.assignment_id,
    }

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
            "evaluation",
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

    assignment.refresh_from_db()
    return JsonResponse({
        "message": "Task evaluated successfully.",
        "assignment": _serialize_assignment(assignment),
    }, status=201)


@login_required
@require_POST
def auto_evaluate_task_assignment_api(request, assignment_id: int):
    assignment = get_object_or_404(
        TaskAssignment.objects.select_related("project"),
        id=assignment_id
    )

    if not can_review_tasks(assignment.project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    try:
        evaluation = auto_evaluate_assignment(
            assignment_id=assignment.id,
            evaluator=request.user,
        )
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=400)

    assignment.refresh_from_db()
    return JsonResponse({
        "message": "Task auto-evaluated successfully.",
        "assignment": _serialize_assignment(assignment),
    }, status=201)



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
def my_notifications_api(request):
    items = (
        Notification.objects
        .filter(user=request.user)
        .select_related("project")
        .order_by("-created_at")[:30]
    )

    unread_count = Notification.objects.filter(user=request.user, is_read=False).count()

    return JsonResponse({
        "items": [_serialize_notification(item) for item in items],
        "unreadCount": unread_count,
    })


@login_required
@require_POST
def mark_notification_read_api(request, notification_id: int):
    notification = get_object_or_404(
        Notification,
        id=notification_id,
        user=request.user,
    )

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at"])

    return JsonResponse({
        "message": "Notification marked as read.",
        "notification": _serialize_notification(notification),
    })


@login_required
@require_POST
def mark_all_notifications_read_api(request):
    unread_items = Notification.objects.filter(user=request.user, is_read=False)

    now = timezone.now()
    unread_items.update(is_read=True, read_at=now)

    return JsonResponse({
        "message": "All notifications marked as read.",
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
    membership_ids = list(memberships.values_list("id", flat=True))

    assignment_counts = (
        TaskAssignment.objects
        .filter(developer_membership_id__in=membership_ids)
        .values("developer_membership_id")
        .annotate(
            total=Count("id"),
            accepted=Count("id", filter=Q(status=TaskAssignment.Status.ACCEPTED)),
            rejected=Count("id", filter=Q(status=TaskAssignment.Status.REJECTED)),
            submitted=Count("id", filter=Q(status=TaskAssignment.Status.SUBMITTED)),
            in_progress=Count("id", filter=Q(status=TaskAssignment.Status.IN_PROGRESS)),
            avg_score=Avg("evaluation__final_score"),
        )
    )

    counts_by_membership = {r["developer_membership_id"]: r for r in assignment_counts}

    developer_map = {}

    for membership in memberships:
        dev_user = membership.user
        counts = counts_by_membership.get(membership.id, {})

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
                "avgScores": [],
            }

        entry = developer_map[dev_user.id]
        entry["projects"].add(membership.project_id)
        entry["totalAssigned"] += counts.get("total", 0)
        entry["acceptedCount"] += counts.get("accepted", 0)
        entry["rejectedCount"] += counts.get("rejected", 0)
        entry["submittedCount"] += counts.get("submitted", 0)
        entry["inProgressCount"] += counts.get("in_progress", 0)

        avg = counts.get("avg_score")
        if avg is not None:
            entry["avgScores"].append(float(avg))

    items = []
    for entry in developer_map.values():
        total_assigned = entry["totalAssigned"]
        accepted_count = entry["acceptedCount"]

        average_score = (
            round(sum(entry["avgScores"]) / len(entry["avgScores"]), 2)
            if entry["avgScores"]
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

@login_required
@require_GET
def my_performance_insights_api(request):
    user = request.user

    memberships = (
        ProjectMembership.objects
        .select_related("project")
        .filter(user=user, role="DEVELOPER")
    )

    membership_ids = list(memberships.values_list("id", flat=True))

    assignments = (
        TaskAssignment.objects
        .select_related(
            "project",
            "bpmn_task",
            "evaluation",
            "evaluation__evaluator",
            "developer_membership__user",
        )
        .filter(developer_membership_id__in=membership_ids)
        .order_by("-assigned_at")
    )

    total_assigned = assignments.count()
    accepted_count = assignments.filter(status=TaskAssignment.Status.ACCEPTED).count()
    rejected_count = assignments.filter(status=TaskAssignment.Status.REJECTED).count()
    submitted_count = assignments.filter(status=TaskAssignment.Status.SUBMITTED).count()
    in_progress_count = assignments.filter(status=TaskAssignment.Status.IN_PROGRESS).count()

    evaluations = TaskEvaluation.objects.filter(assignment__in=assignments)
    avg_final_score = evaluations.aggregate(avg=Avg("final_score"))["avg"] or 0
    acceptance_rate = (accepted_count / total_assigned * 100) if total_assigned else 0

    project_items = []
    for membership in memberships:
        project = membership.project
        project_assignments = assignments.filter(developer_membership=membership)

        project_total = project_assignments.count()
        project_accepted = project_assignments.filter(
            status=TaskAssignment.Status.ACCEPTED
        ).count()
        project_rejected = project_assignments.filter(
            status=TaskAssignment.Status.REJECTED
        ).count()
        project_submitted = project_assignments.filter(
            status=TaskAssignment.Status.SUBMITTED
        ).count()
        project_in_progress = project_assignments.filter(
            status=TaskAssignment.Status.IN_PROGRESS
        ).count()

        project_evaluations = TaskEvaluation.objects.filter(assignment__in=project_assignments)
        project_avg_score = project_evaluations.aggregate(avg=Avg("final_score"))["avg"] or 0
        project_acceptance_rate = (
            (project_accepted / project_total) * 100 if project_total else 0
        )

        project_items.append({
            "projectId": project.id,
            "projectName": getattr(project, "name", None)
                or getattr(project, "title", None)
                or f"Project #{project.id}",
            "totalAssigned": project_total,
            "acceptedCount": project_accepted,
            "rejectedCount": project_rejected,
            "submittedCount": project_submitted,
            "inProgressCount": project_in_progress,
            "acceptanceRate": round(project_acceptance_rate, 2),
            "averageScore": round(float(project_avg_score), 2),
        })

    recent_items = []
    for assignment in assignments[:8]:
        recent_items.append({
            "assignmentId": assignment.id,
            "projectId": assignment.project_id,
            "projectName": getattr(assignment.project, "name", None)
                or getattr(assignment.project, "title", None)
                or f"Project #{assignment.project_id}",
            "status": assignment.status,
            "assignedAt": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
            "startedAt": assignment.started_at.isoformat() if assignment.started_at else None,
            "submittedAt": assignment.submitted_at.isoformat() if assignment.submitted_at else None,
            "reviewedAt": assignment.reviewed_at.isoformat() if assignment.reviewed_at else None,
            "task": {
                "id": assignment.bpmn_task.id,
                "taskId": assignment.bpmn_task.task_id,
                "name": assignment.bpmn_task.name,
                "description": assignment.bpmn_task.description,
            },
            "evaluation": _serialize_evaluation(getattr(assignment, "evaluation", None)),
        })

    all_dev_memberships = (
        ProjectMembership.objects
        .select_related("user")
        .filter(role="DEVELOPER")
    )

    all_membership_ids = list(all_dev_memberships.values_list("id", flat=True))

    ranking_counts = (
        TaskAssignment.objects
        .filter(developer_membership_id__in=all_membership_ids)
        .values("developer_membership_id")
        .annotate(
            total=Count("id"),
            accepted=Count("id", filter=Q(status=TaskAssignment.Status.ACCEPTED)),
            avg_score=Avg("evaluation__final_score"),
        )
    )

    ranking_counts_by_membership = {
        r["developer_membership_id"]: r for r in ranking_counts
    }

    developer_map = {}

    for membership in all_dev_memberships:
        dev_user = membership.user
        counts = ranking_counts_by_membership.get(membership.id, {})

        if dev_user.id not in developer_map:
            developer_map[dev_user.id] = {
                "userId": dev_user.id,
                "username": dev_user.username,
                "email": dev_user.email,
                "projects": set(),
                "totalAssigned": 0,
                "acceptedCount": 0,
                "avgScores": [],
            }

        entry = developer_map[dev_user.id]
        entry["projects"].add(membership.project_id)
        entry["totalAssigned"] += counts.get("total", 0)
        entry["acceptedCount"] += counts.get("accepted", 0)

        avg = counts.get("avg_score")
        if avg is not None:
            entry["avgScores"].append(float(avg))

    ranking_items = []
    for entry in developer_map.values():
        avg_score = (
            round(sum(entry["avgScores"]) / len(entry["avgScores"]), 2)
            if entry["avgScores"]
            else 0.0
        )

        total_dev_assigned = entry["totalAssigned"]
        dev_acceptance_rate = (
            round((entry["acceptedCount"] / total_dev_assigned) * 100, 2)
            if total_dev_assigned
            else 0.0
        )

        ranking_items.append({
            "userId": entry["userId"],
            "username": entry["username"],
            "email": entry["email"],
            "projectsCount": len(entry["projects"]),
            "totalAssigned": total_dev_assigned,
            "acceptedCount": entry["acceptedCount"],
            "acceptanceRate": dev_acceptance_rate,
            "averageScore": avg_score,
        })

    ranking_items.sort(
        key=lambda x: (-x["averageScore"], -x["acceptedCount"], x["username"].lower())
    )

    my_rank = None
    for index, item in enumerate(ranking_items, start=1):
        item["rank"] = index
        if item["userId"] == user.id:
            my_rank = item

    top_developers = ranking_items[:5]

    project_items.sort(
        key=lambda x: (-x["averageScore"], -x["acceptedCount"], x["projectName"].lower())
    )

    return JsonResponse({
        "summary": {
            "userId": user.id,
            "username": user.username,
            "email": user.email,
            "projectsCount": memberships.count(),
            "totalAssigned": total_assigned,
            "acceptedCount": accepted_count,
            "rejectedCount": rejected_count,
            "submittedCount": submitted_count,
            "inProgressCount": in_progress_count,
            "acceptanceRate": round(acceptance_rate, 2),
            "averageScore": round(float(avg_final_score), 2),
        },
        "projects": project_items,
        "recentAssignments": recent_items,
        "ranking": {
            "myRank": my_rank,
            "totalDevelopers": len(ranking_items),
            "topDevelopers": top_developers,
        },
    })