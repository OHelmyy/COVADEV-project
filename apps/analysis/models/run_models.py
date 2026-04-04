from django.db import models


class AnalysisRun(models.Model):
    """
    One analysis execution for a project.
    We store status + timestamps + error to show history on the UI.
    """

    STATUS_CHOICES = (
        ("PENDING", "PENDING"),
        ("RUNNING", "RUNNING"),
        ("DONE", "DONE"),
        ("FAILED", "FAILED"),
    )

    project = models.ForeignKey(
        "projects.Project",
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
        return f"Run(Project={self.project_id}) - {self.status}"