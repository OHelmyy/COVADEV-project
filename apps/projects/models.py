# apps/projects/models.py
from django.db import models
from django.contrib.auth.models import User


class Project(models.Model):
    """
    Main container for a validation project.
    The evaluator creates it, then can add developers as project members.

    Versioning removed:
    - We keep only the current "active" BPMN and Code ZIP.
    - Upload history is kept in ProjectFile (upload logs).
    """

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_projects")

    similarity_threshold = models.FloatField(default=0.6)
    created_at = models.DateTimeField(auto_now_add=True)

    # Active upload pointers (no versions)
    active_bpmn = models.ForeignKey(
        "projects.ProjectFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_for_bpmn_projects",
    )
    active_code = models.ForeignKey(
        "projects.ProjectFile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_for_code_projects",
    )

    def __str__(self):
        return self.name


class ProjectMembership(models.Model):
    """
    Project-level roles:
    - Evaluator: manages members + BPMN + settings
    - Developer: can upload code + run analysis (as you requested)
    """

    class Role(models.TextChoices):
        EVALUATOR = "EVALUATOR", "Evaluator"
        DEVELOPER = "DEVELOPER", "Developer"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="project_memberships")
    role = models.CharField(max_length=20, choices=Role.choices)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["project", "user"], name="uniq_project_member")
        ]

    def __str__(self):
        return f"{self.user.username} -> {self.project.name} ({self.role})"


class ProjectFile(models.Model):
    """
    Upload log record.
    Every upload creates a ProjectFile row so evaluator can audit:
    - who uploaded
    - what type
    - file name
    - where it was stored
    - when it happened

    project.active_bpmn / project.active_code point to the "current" files.
    """

    FILE_TYPES = (
        ("BPMN", "BPMN"),
        ("CODE", "CODE"),
    )

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="files")

    file_type = models.CharField(max_length=10, choices=FILE_TYPES)
    original_name = models.CharField(max_length=255)
    stored_path = models.TextField()

    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Project={self.project_id} {self.file_type} {self.original_name}"


class CodeFile(models.Model):
    """
    Indexed file list extracted from the most recently uploaded Code ZIP.
    We replace the index each time a new ZIP is uploaded.

    This powers:
    - file browsing in UI
    - downstream analysis pipeline
    """

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="code_files")

    relative_path = models.TextField()
    ext = models.CharField(max_length=30, blank=True, default="")
    size_bytes = models.BigIntegerField(default=0)

    # who uploaded the ZIP that produced this index
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    indexed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["relative_path"]

    def __str__(self):
        return f"{self.relative_path} ({self.ext})"
