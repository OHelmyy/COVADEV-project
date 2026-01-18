from django.db import models
from apps.projects.models import UploadVersion


class AnalysisRun(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "PENDING"),
        ("RUNNING", "RUNNING"),
        ("DONE", "DONE"),
        ("FAILED", "FAILED"),
    )

    version = models.ForeignKey(
        UploadVersion,
        on_delete=models.CASCADE,
        related_name="analysis_runs",
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="PENDING")
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Run({self.version}) - {self.status}"


class BpmnTask(models.Model):
    version = models.ForeignKey(
        UploadVersion,
        on_delete=models.CASCADE,
        related_name="bpmn_tasks",
    )

    task_id = models.CharField(max_length=200)  # BPMN task id from XML
    name = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("version", "task_id")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.task_id})"
