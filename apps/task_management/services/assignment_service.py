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

import re
from apps.task_management.models import TaskStatusLog, TaskSubmission
from apps.github_integration.models import GitHubRepository
from apps.github_integration.services.github_service import GitHubService

logger = logging.getLogger(__name__)


def generate_clean_branch_name(task_name, developer_username, project):
    # lowercase, replace spaces with hyphens, remove special characters
    task_slug = task_name.lower()
    task_slug = re.sub(r'[^a-z0-9\s-]', '', task_slug)
    task_slug = re.sub(r'[\s-]+', '-', task_slug)
    task_slug = task_slug.strip('-')

    dev_slug = developer_username.lower()
    dev_slug = re.sub(r'[^a-z0-9\s-]', '', dev_slug)
    dev_slug = re.sub(r'[\s-]+', '-', dev_slug)
    dev_slug = dev_slug.strip('-')

    base_branch = f"task/{task_slug}-{dev_slug}"

    # avoid duplicate branch names in the same project
    candidate = base_branch
    suffix = 1
    while TaskAssignment.objects.filter(project=project, github_branch=candidate).exists():
        candidate = f"{base_branch}-{suffix}"
        suffix += 1

    return candidate


def try_create_github_branch(project, branch_name):
    """
    Attempts to create the branch on GitHub from the default branch.
    If success, returns (True, message)
    If failure/not connected, returns (False, message)
    """
    try:
        repo = GitHubRepository.objects.get(project=project, is_connected=True)
        service = GitHubService(token=repo.access_token)
        
        # Check if branch exists
        try:
            service.get_branch(repo.owner, repo.repo_name, branch_name)
            return True, "Branch already exists on GitHub."
        except Exception:
            # Get default branch latest SHA
            try:
                db_branch = service.get_branch(repo.owner, repo.repo_name, repo.default_branch)
                base_sha = db_branch["commit"]["sha"]
                service.create_branch(repo.owner, repo.repo_name, branch_name, base_sha)
                return True, "Branch created successfully on GitHub."
            except Exception as e:
                return False, f"Failed to create branch on GitHub: {str(e)}"
    except GitHubRepository.DoesNotExist:
        # TODO: call branch creation service when GitHub integration is connected
        return False, "GitHub repository not connected for this project."
    except Exception as e:
        return False, f"GitHub check failed: {str(e)}"


def assign_task(*, project, bpmn_task_id, developer_membership_id, assigned_by, notes="", create_branch=False):
    task = get_object_or_404(BpmnTask, id=bpmn_task_id, project=project)
    membership = get_object_or_404(
        ProjectMembership,
        id=developer_membership_id,
        project=project,
    )

    if membership.role != "DEVELOPER":
        raise ValidationError("Selected member is not a developer.")

    # Prevent duplicate active assignments for the same BPMN task and Developer
    active_statuses = [
        TaskAssignment.Status.ASSIGNED,
        TaskAssignment.Status.IN_PROGRESS,
        TaskAssignment.Status.SUBMITTED,
        TaskAssignment.Status.UNDER_REVIEW,
        TaskAssignment.Status.NEEDS_CHANGES,
    ]
    if TaskAssignment.objects.filter(
        bpmn_task=task,
        developer_membership=membership,
        status__in=active_statuses
    ).exists():
        raise ValidationError("This developer already has an active assignment for this task.")

    old_assignment = TaskAssignment.objects.filter(bpmn_task=task).select_related(
        "developer_membership__user"
    ).first()
    old_developer_user_id = old_assignment.developer_membership.user_id if old_assignment else None

    # Generate clean branch name
    branch_name = generate_clean_branch_name(task.name, membership.user.username, project)

    assignment, created = TaskAssignment.objects.update_or_create(
        bpmn_task=task,
        defaults={
            "project": project,
            "developer_membership": membership,
            "assigned_by": assigned_by,
            "assignment_notes": notes,
            "status": TaskAssignment.Status.ASSIGNED,
            "github_branch": branch_name,
            "submission_notes": "",
            "review_notes": "",
            "started_at": None,
            "submitted_at": None,
            "reviewed_at": None,
            "reviewed_by": None,
        }
    )

    # Log initial status assignment
    TaskStatusLog.objects.create(
        assignment=assignment,
        old_status="",
        new_status=TaskAssignment.Status.ASSIGNED,
        changed_by=assigned_by,
        note=f"Task assigned to {membership.user.username}."
    )

    # Attempt to create GitHub branch if requested
    if create_branch:
        success, msg = try_create_github_branch(project, branch_name)
        if not success:
            logger.warning(f"Could not create GitHub branch during assignment: {msg}")

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


def submit_assignment(*, assignment: TaskAssignment, submitted_by, github_branch=None, github_pr_number=None, github_pr_url="", submission_note="", status="SUBMITTED"):
    old_status = assignment.status
    assignment.status = status
    assignment.submission_notes = submission_note

    if github_pr_number is not None and not github_pr_url:
        try:
            from apps.github_integration.models import GitHubRepository
            repo = GitHubRepository.objects.filter(project=assignment.project).first()
            if repo and repo.github_url:
                github_pr_url = f"{repo.github_url.rstrip('/')}/pull/{github_pr_number}"
            elif assignment.project.github_repo_url:
                github_pr_url = f"{assignment.project.github_repo_url.rstrip('/')}/pull/{github_pr_number}"
        except Exception:
            pass

    if github_pr_number is not None:
        assignment.github_pr_number = github_pr_number
    if github_pr_url:
        assignment.github_pr_url = github_pr_url
    assignment.submitted_at = timezone.now()
    assignment.save()

    sub = TaskSubmission.objects.create(
        assignment=assignment,
        submitted_by=submitted_by,
        github_branch=github_branch or assignment.github_branch or "main",
        github_pr_number=github_pr_number,
        github_pr_url=github_pr_url,
        submission_note=submission_note,
        status=status,
    )

    # Log status change
    TaskStatusLog.objects.create(
        assignment=assignment,
        old_status=old_status,
        new_status=status,
        changed_by=submitted_by,
        note=submission_note or "Task submitted."
    )
    return assignment, sub


def review_assignment(*, assignment: TaskAssignment, reviewed_by, accepted: bool, review_notes=""):
    old_status = assignment.status
    new_status = TaskAssignment.Status.ACCEPTED if accepted else TaskAssignment.Status.REJECTED
    assignment.status = new_status
    assignment.reviewed_by = reviewed_by
    assignment.review_notes = review_notes
    assignment.reviewed_at = timezone.now()
    assignment.save()

    create_task_reviewed_notification(assignment)

    # Log status change
    TaskStatusLog.objects.create(
        assignment=assignment,
        old_status=old_status,
        new_status=new_status,
        changed_by=reviewed_by,
        note=review_notes or f"Evaluator reviewed task: {'accepted' if accepted else 'rejected'}."
    )

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

def start_assignment(*, assignment, started_by):
    if assignment.status == TaskAssignment.Status.ASSIGNED:
        old_status = assignment.status
        assignment.status = TaskAssignment.Status.IN_PROGRESS
        assignment.started_at = timezone.now()
        assignment.save()

        # Log status change
        TaskStatusLog.objects.create(
            assignment=assignment,
            old_status=old_status,
            new_status=TaskAssignment.Status.IN_PROGRESS,
            changed_by=started_by,
            note="Developer started task."
        )
    return assignment