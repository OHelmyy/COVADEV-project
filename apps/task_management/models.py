# apps/task_management/models.py
from decimal import Decimal

from django.db import models
from django.contrib.auth.models import User
from django.forms import ValidationError
from apps.projects.models import Project, ProjectMembership
from apps.analysis.models import BpmnTask

#task assignment data model to be used in assigning tasks to a developer and to be used in evaluating developers performance
class TaskAssignment(models.Model):
    class Status(models.TextChoices):
        ASSIGNED = "ASSIGNED", "Assigned"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        SUBMITTED = "SUBMITTED", "Submitted"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
        NEEDS_CHANGES = "NEEDS_CHANGES", "Needs Changes"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"
        MERGED = "MERGED", "Merged"

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="task_assignments"
    )
    bpmn_task = models.OneToOneField(
        BpmnTask,
        on_delete=models.CASCADE,
        related_name="assignment"
    )
    developer_membership = models.ForeignKey(
        ProjectMembership,
        on_delete=models.CASCADE,
        related_name="task_assignments"
    )
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="assigned_tasks"
    )

    github_branch = models.CharField(max_length=255, blank=True, default="")
    github_pr_number = models.IntegerField(null=True, blank=True)
    github_pr_url = models.URLField(max_length=500, blank=True, default="")

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ASSIGNED
    )

    assignment_notes = models.TextField(blank=True, default="")
    submission_notes = models.TextField(blank=True, default="")
    review_notes = models.TextField(blank=True, default="")

    assigned_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    reviewed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_task_assignments"
    )

    updated_at = models.DateTimeField(auto_now=True)
    # Number of times this AI assignment has been re-submitted to the AI
    # (only meaningful when the developer_membership is an AI agent)
    ai_retry_count = models.IntegerField(default=0)
        
    @property
    def actual_duration_minutes(self):
        if not self.started_at or not self.submitted_at:
            return None

        seconds = (self.submitted_at - self.started_at).total_seconds()
        if seconds < 0:
            return None

        return round(seconds / 60)


    @property
    def estimated_duration_minutes(self):
        return getattr(self.bpmn_task, "estimated_duration_minutes", None)


    @property
    def time_difference_minutes(self):
        estimated = self.estimated_duration_minutes
        actual = self.actual_duration_minutes

        if estimated is None or actual is None:
            return None

        return actual - estimated


    @property
    def time_tracking_status(self):
        estimated = self.estimated_duration_minutes
        actual = self.actual_duration_minutes

        if estimated is None:
            return "NO_ESTIMATE"

        if not self.started_at:
            return "NOT_STARTED"

        if self.started_at and not self.submitted_at:
            return "IN_PROGRESS"

        if actual is None:
            return "NO_ACTUAL_TIME"

        diff = actual - estimated

        if diff <= -10:
            return "COMPLETED_EARLY"

        if diff <= 5:
            return "ON_TIME"

        if diff <= 20:
            return "SLIGHTLY_OVER"

        return "OVER_ESTIMATE"
        
    
    class Meta:
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.project_id} | {self.bpmn_task.name} -> {self.developer_membership.user.username}"
    
# data model for evaluation

class TaskEvaluation(models.Model):
    assignment = models.OneToOneField(
        TaskAssignment,
        on_delete=models.CASCADE,
        related_name="evaluation"
    )
    evaluator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="task_evaluations"
    )

    correctness_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    quality_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    timeliness_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    communication_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    final_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    comments = models.TextField(blank=True, default="")
    evaluated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-evaluated_at"]

    def __str__(self):
        return f"Evaluation for assignment #{self.assignment_id}"
    
    def clean(self):
        score_fields = [
            self.correctness_score,
            self.quality_score,
            self.timeliness_score,
            self.communication_score,
        ]

        for value in score_fields:
            if value < 0 or value > 100:
                raise ValidationError("All scores must be between 0 and 100.")

        if self.assignment.status not in [
            TaskAssignment.Status.ACCEPTED,
            TaskAssignment.Status.REJECTED,
        ]:
            raise ValidationError("Task can only be evaluated after review.")

    def calculate_final_score(self):
        self.final_score = (
            Decimal(self.correctness_score)
            + Decimal(self.quality_score)
            + Decimal(self.timeliness_score)
            + Decimal(self.communication_score)
        ) / Decimal("4")

    def save(self, *args, **kwargs):
        self.calculate_final_score()
        self.full_clean()
        super().save(*args, **kwargs)

class Notification(models.Model):
    class Type(models.TextChoices):
        TASK_ASSIGNED = "TASK_ASSIGNED", "Task Assigned"
        TASK_REVIEWED = "TASK_REVIEWED", "Task Reviewed"
        TASK_EVALUATED = "TASK_EVALUATED", "Task Evaluated"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    project = models.ForeignKey(
        Project,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    assignment = models.ForeignKey(
        TaskAssignment,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    type = models.CharField(
        max_length=30,
        choices=Type.choices,
    )

    title = models.CharField(max_length=255)
    message = models.TextField()

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} | {self.type} | {self.title}"
    

# ---------------------------------------------------------------------------
# AI Agent submissions
# ---------------------------------------------------------------------------

class AISubmission(models.Model):
    """
    Holds the AI agent's structured submission for a TaskAssignment.
    One assignment can have multiple submissions if the evaluator
    sends the work back for retry.
    """

    assignment = models.ForeignKey(
        TaskAssignment,
        on_delete=models.CASCADE,
        related_name="ai_submissions",
    )

    explanation = models.TextField(blank=True, default="")
    model_used = models.CharField(max_length=100, blank=True, default="")
    tokens_used = models.IntegerField(default=0)
    attempt_number = models.IntegerField(default=1)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"AISubmission(assignment={self.assignment_id}, attempt={self.attempt_number})"


class AIGeneratedFile(models.Model):
    """
    A single file produced by the AI as part of an AISubmission.
    The AI agent only produces Python files in this project.
    """

    submission = models.ForeignKey(
        AISubmission,
        on_delete=models.CASCADE,
        related_name="files",
    )

    filename = models.CharField(max_length=255)
    language = models.CharField(max_length=30, default="python")
    content = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["filename"]

    def __str__(self):
        return f"{self.filename} ({self.language})"


class AIExecutionLog(models.Model):
    """
    Audit log of every LLM call made on behalf of a TaskAssignment.
    Used for debugging and for the AI performance dashboard.
    """

    STATUS_CHOICES = (
        ("SUCCESS", "Success"),
        ("FAILED", "Failed"),
    )

    assignment = models.ForeignKey(
        TaskAssignment,
        on_delete=models.CASCADE,
        related_name="ai_logs",
    )

    prompt = models.TextField()
    response = models.TextField(blank=True, default="")
    model = models.CharField(max_length=100, blank=True, default="")
    tokens = models.IntegerField(default=0)
    latency_ms = models.IntegerField(default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="SUCCESS")
    error_message = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"AIExecutionLog(assignment={self.assignment_id}, status={self.status})"    
    
def developer_submission_upload_path(instance, filename):
    return f"projects/{instance.project.id}/developer_submissions/{instance.assignment.id}/{filename}"


class DeveloperSubmission(models.Model):
    class Status(models.TextChoices):
        PENDING    = "PENDING",    "Pending Review"
        ACCEPTED   = "ACCEPTED",   "Accepted"
        REJECTED   = "REJECTED",   "Rejected"
        REASSIGNED = "REASSIGNED", "Reassigned"

    assignment = models.ForeignKey(
        TaskAssignment,
        on_delete=models.CASCADE,
        related_name="developer_submissions",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="developer_submissions",
    )
    zip_file = models.FileField(upload_to=developer_submission_upload_path)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    attempt_number = models.IntegerField(default=1)
    feedback        = models.TextField(blank=True, default="")
    submitted_at    = models.DateTimeField(auto_now_add=True)
    reviewed_at     = models.DateTimeField(null=True, blank=True)
    reviewed_by     = models.ForeignKey(
        User,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_developer_submissions",
    )

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"DevSubmission(assignment={self.assignment_id}, attempt={self.attempt_number}, status={self.status})"


class TaskSubmission(models.Model):
    assignment = models.ForeignKey(
        TaskAssignment,
        on_delete=models.CASCADE,
        related_name="submissions"
    )
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="task_submissions"
    )
    github_branch = models.CharField(max_length=255)
    github_pr_number = models.IntegerField(null=True, blank=True)
    github_pr_url = models.URLField(max_length=500, null=True, blank=True)
    submission_note = models.TextField(blank=True, default="")
    status = models.CharField(max_length=50)
    
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"TaskSubmission(assignment={self.assignment_id}, status={self.status})"


class TaskStatusLog(models.Model):
    assignment = models.ForeignKey(
        TaskAssignment,
        on_delete=models.CASCADE,
        related_name="status_logs"
    )
    old_status = models.CharField(max_length=50)
    new_status = models.CharField(max_length=50)
    changed_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="status_logs"
    )
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"TaskStatusLog(assignment={self.assignment_id}, {self.old_status} -> {self.new_status})"