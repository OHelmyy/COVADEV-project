# apps/projects/models.py
from django.db import models
from django.contrib.auth.models import User


class Project(models.Model):
    """
    Main container for a validation project.

    ✅ New rules:
    - ONLY Admin creates projects (enforced in views / API).
    - Admin assigns:
        - evaluator (one user)
        - developers (many users) via ProjectMembership rows

    Notes:
    - created_by remains useful as "created by admin".
    - evaluator is stored on the project directly for fast filtering/permissions.
    """

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Admin user who created the project
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_projects")

    # The evaluator assigned by admin (one per project)
    evaluator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_evaluator_projects",
    )

    similarity_threshold = models.FloatField(default=0.6)
    created_at = models.DateTimeField(auto_now_add=True)

    # Active upload pointers (no versioning)
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
    Developers assigned to a project.

    ✅ Under your latest rules:
    - evaluator is NOT stored as membership (it's Project.evaluator).
    - membership rows represent developers added by admin (or evaluator if you allow later).
    - Admin has system role; not required as membership.

    Compatibility:
    - We keep a 'role' field defaulting to DEVELOPER in case older code expects m.role.
      Your API uses getattr(m, "role", "DEVELOPER") so either way works.
    """

    class Role(models.TextChoices):
        DEVELOPER = "DEVELOPER", "Developer"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="project_memberships")

    # Optional/compat field (safe default)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.DEVELOPER)

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
    Every upload creates a ProjectFile row for auditing:
    - who uploaded
    - what type
    - original name
    - stored path
    - extracted_dir for code zips
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

    # for CODE: absolute or relative folder path after extraction
    extracted_dir = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Project={self.project_id} {self.file_type} {self.original_name}"


class CodeFile(models.Model):
    """
    Indexed file list extracted from the most recently uploaded Code ZIP.
    Replaced each time a new ZIP is uploaded.

    Powers:
    - file browsing in UI
    - downstream analysis pipeline
    """

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="code_files")

    relative_path = models.TextField()
    ext = models.CharField(max_length=30, blank=True, default="")
    size_bytes = models.BigIntegerField(default=0)

    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    indexed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["relative_path"]

    def __str__(self):
        return f"{self.relative_path} ({self.ext})"