# apps/analysis/models.py
from django.db import models
from apps.analysis.models_code import CodeArtifact

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

    # Project-based (versioning removed)
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

    task_id = models.CharField(max_length=200)  # BPMN task id from XML
    name = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    summary_text = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    incoming_nodes = models.JSONField(default=list, blank=True)              
    outgoing_nodes = models.JSONField(default=list, blank=True)
    task_type = models.CharField(max_length=50, blank=True, default="")       
    # AI suitability classification (filled by AI suitability classifier service)
    AI_SUITABILITY_CHOICES = (
        ("RECOMMENDED", "Recommended"),
        ("NEUTRAL", "Neutral"),
        ("NOT_RECOMMENDED", "Not Recommended"),
        ("UNKNOWN", "Unknown"),
    )
    ai_suitability = models.CharField(
        max_length=20,
        choices=AI_SUITABILITY_CHOICES,
        default="UNKNOWN",
    )
    ai_suitability_reason = models.TextField(blank=True, default="")
    ai_suitability_checked_at = models.DateTimeField(null=True, blank=True)           
    class Meta:
        # Task IDs are unique within the same project
        constraints = [
            models.UniqueConstraint(fields=["project", "task_id"], name="uniq_project_taskid")
        ]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.task_id})"


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

    # For matched/missing tasks (nullable for EXTRA)
    task = models.ForeignKey(
        BpmnTask,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matches",
    )

    # code reference (MVP: store file path + symbol name if available)
    code_ref = models.CharField(max_length=800, blank=True, default="")

    similarity_score = models.FloatField(default=0.0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    matched_summary = models.TextField(blank=True, default="")
    is_ai_generated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-similarity_score", "-created_at"]

    def __str__(self):
        return f"{self.status} - {self.similarity_score:.2f} (Project={self.project_id})"


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

    # Store as lines, each line starts with "- "
    recommendations_text = models.TextField(blank=True, default="")

    # Keep the summary used to generate (helps you know if BPMN summary changed)
    source_summary = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def as_list(self) -> list[str]:
        return [x.strip() for x in (self.recommendations_text or "").splitlines() if x.strip()]

    def __str__(self):
        return f"BpmnRecommendations(Project={self.project_id})"
    

class CodeEmbedding(models.Model):
    """
    Stores the embedding vector for a code artifact.
    Allows skipping re-embedding if code hasn't changed.
    """
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="code_embeddings",
    )
    code_artifact = models.ForeignKey(
        CodeArtifact,
        on_delete=models.CASCADE,
        related_name="embeddings",
    )
    vector = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("project", "code_artifact")]

    def __str__(self):
        return f"CodeEmbedding({self.code_artifact_id})"


class TaskEmbedding(models.Model):
    """
    Stores the embedding vector for a BPMN task.
    Allows skipping re-embedding if BPMN hasn't changed.
    """
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="task_embeddings",
    )
    bpmn_task = models.ForeignKey(
        BpmnTask,
        on_delete=models.CASCADE,
        related_name="embeddings",
    )
    vector = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("project", "bpmn_task")]

    def __str__(self):
        return f"TaskEmbedding({self.bpmn_task_id})"