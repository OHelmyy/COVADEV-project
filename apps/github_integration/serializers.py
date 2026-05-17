from rest_framework import serializers
from .models import GitHubRepository

class GitHubRepositorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GitHubRepository
        fields = [
            "id", "project", "owner", "repo_name", 
            "default_branch", "github_url", "is_connected", 
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "is_connected", "github_url", "created_at", "updated_at"]

class GitHubConnectSerializer(serializers.Serializer):
    owner = serializers.CharField(max_length=255)
    repo_name = serializers.CharField(max_length=255)
    access_token = serializers.CharField(max_length=255, write_only=True)
    default_branch = serializers.CharField(max_length=255, default="main")

class GitHubBranchSerializer(serializers.Serializer):
    name = serializers.CharField()
    commit = serializers.JSONField()
    protected = serializers.BooleanField()

class GitHubPullRequestSerializer(serializers.Serializer):
    number = serializers.IntegerField()
    title = serializers.CharField()
    state = serializers.CharField()
    html_url = serializers.URLField()
    user = serializers.JSONField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    closed_at = serializers.DateTimeField(required=False, allow_null=True)
    merged_at = serializers.DateTimeField(required=False, allow_null=True)
    head = serializers.JSONField()
    base = serializers.JSONField()

class GitHubFileSerializer(serializers.Serializer):
    sha = serializers.CharField()
    filename = serializers.CharField()
    status = serializers.CharField()
    additions = serializers.IntegerField()
    deletions = serializers.IntegerField()
    changes = serializers.IntegerField()
    blob_url = serializers.URLField()
    raw_url = serializers.URLField()
    contents_url = serializers.URLField()
    patch = serializers.CharField(required=False, allow_blank=True)

class GitHubCommitSerializer(serializers.Serializer):
    sha = serializers.CharField()
    commit = serializers.JSONField()
    html_url = serializers.URLField()
    author = serializers.JSONField(required=False, allow_null=True)
    committer = serializers.JSONField(required=False, allow_null=True)
