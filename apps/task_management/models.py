# apps/task_management/models.py
from django.db import models
from django.contrib.auth.models import User
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

    class Meta:
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.project_id} | {self.bpmn_task.name} -> {self.developer_membership.user.username}"