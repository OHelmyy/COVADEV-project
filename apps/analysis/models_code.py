# apps/analysis/models_code.py
from __future__ import annotations

from django.conf import settings
from django.db import models


class CodeArtifact(models.Model):
    """
    Stored code "artifact" extracted from uploaded source code.

    One row typically represents ONE function/method (or class if you choose),
    and stores:
    - raw snippet
    - static analysis metadata (calls/writes/returns)
    - LLM-generated one-sentence intent summary (for embeddings)
    - human-friendly structured summary (for UI/debug)
    """

    KIND_CHOICES = [
        ("function", "function"),
        ("method", "method"),
        ("class", "class"),
    ]

    # Link to project (adjust this to match your actual Project model)
    # If your project model path is different, change this FK.
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="code_artifacts",
    )

    # Stable unique id for the symbol in codebase
    # Example: "payments/service.py::validate_payment@L10-L32"
    code_uid = models.CharField(max_length=512, db_index=True)

    file_path = models.CharField(max_length=512, blank=True, default="")
    language = models.CharField(max_length=64, blank=True, default="python")

    # Name of symbol (function name / class name)
    symbol = models.CharField(max_length=256, blank=True, default="")

    kind = models.CharField(max_length=32, choices=KIND_CHOICES, default="function")

    # Extracted code snippet
    raw_snippet = models.TextField(blank=True, default="")

    # Static analysis signals (JSON arrays)
    calls = models.JSONField(blank=True, default=list)
    writes = models.JSONField(blank=True, default=list)
    returns = models.JSONField(blank=True, default=list)
    exceptions = models.JSONField(blank=True, default=list)

    # Optional owner/developer attribution (if you later connect git blame, etc.)
    developer_id = models.CharField(max_length=128, blank=True, null=True)

    # ✅ 1-sentence LLM summary (used for embedding)
    summary_text = models.TextField(blank=True, default="")

    # ✅ Human-friendly explanation of the structured function object (UI/debug)
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
