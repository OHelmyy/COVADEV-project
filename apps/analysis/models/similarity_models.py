from django.db import models

from .bpmn_models import BpmnTask
from .code_models import CodeArtifact
from .run_models import AnalysisRun


class MatchResult(models.Model):
    """
    Output of matching BPMN tasks to code elements for a project.
    Stored per project (versioning removed).
    """

    STATUS_CHOICES = (
        ("MATCHED", "MATCHED"),
        ("MISSING", "MISSING"),
        ("EXTRA", "EXTRA"),
    )

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="match_results",
    )

    task = models.ForeignKey(
        BpmnTask,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matches",
    )

    code_ref = models.CharField(max_length=800, blank=True, default="")
    similarity_score = models.FloatField(default=0.0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-similarity_score", "-created_at"]

    def __str__(self):
        return f"{self.status} - {self.similarity_score:.2f} (Project={self.project_id})"


class CodeEmbedding(models.Model):
    run = models.ForeignKey(
        AnalysisRun,
        on_delete=models.CASCADE,
        related_name="code_embeddings",
    )
    code_artifact = models.ForeignKey(CodeArtifact, on_delete=models.CASCADE)
    vector = models.JSONField()

    def __str__(self):
        return f"CodeEmbedding(run={self.run_id}, artifact={self.code_artifact_id})"


class SimilarityScore(models.Model):
    run = models.ForeignKey(AnalysisRun, on_delete=models.CASCADE)
    task_id = models.CharField(max_length=255)
    code_artifact = models.ForeignKey(CodeArtifact, on_delete=models.CASCADE)
    score = models.FloatField()

    def __str__(self):
        return f"SimilarityScore(run={self.run_id}, task={self.task_id}, score={self.score:.4f})"