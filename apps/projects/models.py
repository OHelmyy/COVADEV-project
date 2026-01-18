from django.conf import settings
from django.db import models


class Project(models.Model):
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="projects",
    )
    similarity_threshold = models.FloatField(default=0.6)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class UploadVersion(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("project", "version_number")
        ordering = ["-version_number"]

    def __str__(self):
        return f"{self.project.name} v{self.version_number}"


class ProjectFile(models.Model):
    FILE_TYPE_CHOICES = (
        ("BPMN", "BPMN"),
        ("CODE", "CODE"),
    )

    version = models.ForeignKey(
        UploadVersion,
        on_delete=models.CASCADE,
        related_name="files",
    )
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES)
    original_name = models.CharField(max_length=255)
    stored_path = models.CharField(max_length=500)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.file_type} - {self.original_name}"


class CodeFile(models.Model):
    version = models.ForeignKey(
        UploadVersion,
        on_delete=models.CASCADE,
        related_name="code_files",
    )
    relative_path = models.CharField(max_length=700)  # path relative to version root
    ext = models.CharField(max_length=20, blank=True, default="")
    size_bytes = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("version", "relative_path")
        ordering = ["relative_path"]

    def __str__(self):
        return self.relative_path
