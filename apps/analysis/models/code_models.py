from __future__ import annotations

from django.db import models


class CodeArtifact(models.Model):
    """
    Stored code artifact extracted from uploaded source code.

    One row typically represents one function/method/class and stores:
    - raw snippet
    - static analysis metadata
    - LLM-generated one-sentence intent summary
    - human-friendly structured summary
    """

    KIND_CHOICES = [
        ("function", "function"),
        ("method", "method"),
        ("class", "class"),
    ]

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="code_artifacts",
    )

    code_uid = models.CharField(max_length=512, db_index=True)

    file_path = models.CharField(max_length=512, blank=True, default="")
    language = models.CharField(max_length=64, blank=True, default="python")

    symbol = models.CharField(max_length=256, blank=True, default="")
    kind = models.CharField(max_length=32, choices=KIND_CHOICES, default="function")

    raw_snippet = models.TextField(blank=True, default="")

    calls = models.JSONField(blank=True, default=list)
    writes = models.JSONField(blank=True, default=list)
    returns = models.JSONField(blank=True, default=list)
    exceptions = models.JSONField(blank=True, default=list)

    developer_id = models.CharField(max_length=128, blank=True, null=True)

    summary_text = models.TextField(blank=True, default="")
    structured_summary = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("project", "code_uid")]
        indexes = [
            models.Index(fields=["project", "code_uid"]),
            models.Index(fields=["project", "file_path"]),
        ]

    def __str__(self) -> str:
        return f"{self.project_id} :: {self.code_uid}"