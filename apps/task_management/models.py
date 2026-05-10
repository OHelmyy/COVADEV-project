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
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"

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