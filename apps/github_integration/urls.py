from django.urls import path
from .views import (
    GitHubConnectView,
    GitHubRepositoryDetailView,
    GitHubBranchesView,
    GitHubPullRequestListView,
    GitHubPullRequestDetailView,
    GitHubPullRequestFilesView,
    GitHubPullRequestCommitsView,
    GitHubFileContentView,
    GitHubCreateBranchView,
    GitHubMergePullRequestView,
    GitHubFetchAndIndexView
)

app_name = "github_integration"

urlpatterns = [
    path("projects/<int:project_id>/github/connect/", GitHubConnectView.as_view(), name="connect"),
    path("projects/<int:project_id>/github/repository/", GitHubRepositoryDetailView.as_view(), name="repository_detail"),
    path("projects/<int:project_id>/github/branches/", GitHubBranchesView.as_view(), name="branches"),
    path("projects/<int:project_id>/github/branches/create/", GitHubCreateBranchView.as_view(), name="create_branch"),
    path("projects/<int:project_id>/github/pull-requests/", GitHubPullRequestListView.as_view(), name="pull_requests"),
    path("projects/<int:project_id>/github/pull-requests/<int:pr_number>/", GitHubPullRequestDetailView.as_view(), name="pull_request_detail"),
    path("projects/<int:project_id>/github/pull-requests/<int:pr_number>/files/", GitHubPullRequestFilesView.as_view(), name="pull_request_files"),
    path("projects/<int:project_id>/github/pull-requests/<int:pr_number>/commits/", GitHubPullRequestCommitsView.as_view(), name="pull_request_commits"),
    path("projects/<int:project_id>/github/pull-requests/<int:pr_number>/merge/", GitHubMergePullRequestView.as_view(), name="pull_request_merge"),
    path("projects/<int:project_id>/github/file-content/", GitHubFileContentView.as_view(), name="file_content"),
    path("projects/<int:project_id>/github/fetch-and-index/", GitHubFetchAndIndexView.as_view(), name="fetch_and_index"),
]
