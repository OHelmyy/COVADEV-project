import logging

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.analysis.models import BpmnTask
from apps.projects.models import ProjectMembership
from apps.task_management.models import TaskAssignment
from apps.task_management.services.notification_service import send_task_assignment_email
from apps.task_management.services.notification_db_service import (
    create_task_assigned_notification,
    create_task_reviewed_notification,
)

logger = logging.getLogger(__name__)


def assign_task(*, project, bpmn_task_id, developer_membership_id, assigned_by, notes=""):
    task = get_object_or_404(BpmnTask, id=bpmn_task_id, project=project)
    membership = get_object_or_404(
        ProjectMembership,
        id=developer_membership_id,
        project=project,
    )

    if membership.role != "DEVELOPER":
        raise ValidationError("Selected member is not a developer.")

    old_assignment = TaskAssignment.objects.filter(bpmn_task=task).select_related(
        "developer_membership__user"
    ).first()
    old_developer_user_id = old_assignment.developer_membership.user_id if old_assignment else None

    assignment, created = TaskAssignment.objects.update_or_create(
        bpmn_task=task,
        defaults={
            "project": project,
            "developer_membership": membership,
            "assigned_by": assigned_by,
            "assignment_notes": notes,
            "status": TaskAssignment.Status.ASSIGNED,
            "submission_notes": "",
            "review_notes": "",
            "started_at": None,
            "submitted_at": None,
            "reviewed_at": None,
            "reviewed_by": None,
        }
    )

    should_notify = created or old_developer_user_id != membership.user_id
    is_new_ai_assignment = membership.is_ai_agent


    if should_notify:
        create_task_assigned_notification(assignment)

        try:
            send_task_assignment_email(assignment)
        except Exception:
            logger.exception(
                "Task was assigned successfully, but email notification failed for assignment_id=%s",
                assignment.id,
            )

    if is_new_ai_assignment:
        # Lazy import to avoid circular references at app startup
        from django.db import transaction
        from apps.task_management.signals import _schedule_executor

        transaction.on_commit(lambda: _schedule_executor(assignment.id))

    return assignment


def submit_assignment(*, assignment: TaskAssignment, submission_notes=""):
    assignment.status = TaskAssignment.Status.SUBMITTED
    assignment.submission_notes = submission_notes
    assignment.submitted_at = timezone.now()
    assignment.save()
    return assignment


def review_assignment(*, assignment: TaskAssignment, reviewed_by, accepted: bool, review_notes=""):
    assignment.status = (
        TaskAssignment.Status.ACCEPTED
        if accepted else TaskAssignment.Status.REJECTED
    )
    assignment.reviewed_by = reviewed_by
    assignment.review_notes = review_notes
    assignment.reviewed_at = timezone.now()
    assignment.save()

    create_task_reviewed_notification(assignment)

    # When the evaluator accepts an AI submission, push it through
    # semantic matching like uploaded code does. Failures here must NOT
    # break the review flow — log and continue.
    if accepted and assignment.developer_membership.is_ai_agent:
        try:
            from apps.task_management.services.ai_match_service import (
                match_accepted_ai_submission,
            )
            match_accepted_ai_submission(assignment)
        except Exception:
            logger.exception(
                "AI match generation failed for accepted assignment_id=%s",
                assignment.id,
            )

    return assignment

def start_assignment(*, assignment):
    if assignment.status == TaskAssignment.Status.ASSIGNED:
        assignment.status = TaskAssignment.Status.IN_PROGRESS
        assignment.started_at = timezone.now()
        assignment.save()
    return assignment