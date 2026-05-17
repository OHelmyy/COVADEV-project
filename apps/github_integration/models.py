from django.db import models
from apps.projects.models import Project

class GitHubRepository(models.Model):
    """
    Stores connection details for a GitHub repository linked to a project.
    """
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name="github_repo")
    owner = models.CharField(max_length=255)
    repo_name = models.CharField(max_length=255)
    default_branch = models.CharField(max_length=255, default="main")
    github_url = models.URLField(max_length=500, blank=True)
    access_token = models.CharField(max_length=255, help_text="GitHub Personal Access Token")
    is_connected = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "GitHub Repository"
        verbose_name_plural = "GitHub Repositories"

    def __str__(self):
        return f"{self.owner}/{self.repo_name} ({self.project.name})"

    def save(self, *args, **kwargs):
        if not self.github_url:
            self.github_url = f"https://github.com/{self.owner}/{self.repo_name}"
        super().save(*args, **kwargs)
