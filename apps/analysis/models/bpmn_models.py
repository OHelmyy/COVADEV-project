from django.db import models


class BpmnTask(models.Model):
    """
    BPMN Task parsed from the currently active BPMN for a project.
    Stored per project (versioning removed).
    """

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="bpmn_tasks",
    )

    task_id = models.CharField(max_length=200)
    name = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    summary_text = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["project", "task_id"], name="uniq_project_taskid")
        ]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.task_id})"


class BpmnRecommendations(models.Model):
    """
    Recommended methods generated from the stored BPMN summary for a project.
    Stored per project (versioning removed).
    """

    project = models.OneToOneField(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="bpmn_recommendations",
    )

    recommendations_text = models.TextField(blank=True, default="")
    source_summary = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def as_list(self) -> list[str]:
        return [x.strip() for x in (self.recommendations_text or "").splitlines() if x.strip()]

    def __str__(self):
        return f"BpmnRecommendations(Project={self.project_id})"