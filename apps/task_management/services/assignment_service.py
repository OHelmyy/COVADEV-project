from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.analysis.models import BpmnTask
from apps.projects.models import ProjectMembership
from apps.task_management.models import TaskAssignment


def assign_task(*, project, bpmn_task_id, developer_membership_id, assigned_by, notes=""):
    task = get_object_or_404(BpmnTask, id=bpmn_task_id, project=project)
    membership = get_object_or_404(
        ProjectMembership,
        id=developer_membership_id,
        project=project,
    )

    if membership.role != "DEVELOPER":
        raise ValidationError("Selected member is not a developer.")

    assignment, _ = TaskAssignment.objects.update_or_create(
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
    return assignment

def start_assignment(*, assignment):
    if assignment.status == TaskAssignment.Status.ASSIGNED:
        assignment.status = TaskAssignment.Status.IN_PROGRESS
        assignment.started_at = timezone.now()
        assignment.save()
    return assignment