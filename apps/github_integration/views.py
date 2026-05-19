from rest_framework import status, views
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.projects.models import Project
from .models import GitHubRepository
from .serializers import (
    GitHubRepositorySerializer, 
    GitHubConnectSerializer,
    GitHubBranchSerializer,
    GitHubPullRequestSerializer,
    GitHubFileSerializer,
    GitHubCommitSerializer
)
from .services.github_service import GitHubService
from apps.projects.services import save_code_zip_and_extract
from django.core.files.base import ContentFile

class GitHubConnectView(views.APIView):
    """
    Connect a project to a GitHub repository.
    """
    def post(self, request, project_id):
        project = get_object_or_404(Project, id=project_id)
        serializer = GitHubConnectSerializer(data=request.data)
        
        if serializer.is_valid():
            owner = serializer.validated_data["owner"]
            repo_name = serializer.validated_data["repo_name"]
            token = serializer.validated_data["access_token"]
            default_branch = serializer.validated_data.get("default_branch", "main")
            
            service = GitHubService(token=token)
            try:
                # Verify repository existence and access
                repo_data = service.test_connection(owner, repo_name)
                
                # Create or update connection
                repo_obj, created = GitHubRepository.objects.update_or_create(
                    project=project,
                    defaults={
                        "owner": owner,
                        "repo_name": repo_name,
                        "access_token": token,
                        "default_branch": default_branch,
                        "is_connected": True,
                        "github_url": repo_data.get("html_url", "")
                    }
                )
                
                return Response(
                    GitHubRepositorySerializer(repo_obj).data,
                    status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
                )
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class GitHubRepositoryDetailView(views.APIView):
    """
    Get connected repository details.
    """
    def get(self, request, project_id):
        repo = get_object_or_404(GitHubRepository, project_id=project_id)
        serializer = GitHubRepositorySerializer(repo)
        return Response(serializer.data)

class GitHubBaseView(views.APIView):
    """
    Base class to provide GitHub service for a project.
    """
    def get_service(self, project_id):
        repo = get_object_or_404(GitHubRepository, project_id=project_id)
        return GitHubService(token=repo.access_token), repo

class GitHubBranchesView(GitHubBaseView):
    """
    List branches for the connected repository.
    """
    def get(self, request, project_id):
        service, repo = self.get_service(project_id)
        try:
            branches = service.get_branches(repo.owner, repo.repo_name)
            return Response(branches)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class GitHubPullRequestListView(GitHubBaseView):
    """
    List pull requests for the connected repository.
    """
    def get(self, request, project_id):
        state = request.query_params.get("state", "open")
        service, repo = self.get_service(project_id)
        try:
            prs = service.get_pull_requests(repo.owner, repo.repo_name, state=state)
            return Response(prs)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class GitHubPullRequestDetailView(GitHubBaseView):
    """
    Get one pull request's details.
    """
    def get(self, request, project_id, pr_number):
        service, repo = self.get_service(project_id)
        try:
            pr = service.get_pull_request(repo.owner, repo.repo_name, pr_number)
            return Response(pr)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class GitHubPullRequestFilesView(GitHubBaseView):
    """
    Get changed files in a pull request.
    """
    def get(self, request, project_id, pr_number):
        service, repo = self.get_service(project_id)
        try:
            files = service.get_pull_request_files(repo.owner, repo.repo_name, pr_number)
            return Response(files)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class GitHubPullRequestCommitsView(GitHubBaseView):
    """
    Get commits in a pull request.
    """
    def get(self, request, project_id, pr_number):
        service, repo = self.get_service(project_id)
        try:
            commits = service.get_pull_request_commits(repo.owner, repo.repo_name, pr_number)
            return Response(commits)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class GitHubFileContentView(GitHubBaseView):
    """
    Get file content from a branch or commit.
    """
    def get(self, request, project_id):
        path = request.query_params.get("path")
        ref = request.query_params.get("ref")
        
        if not path:
            return Response({"error": "Path parameter is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        service, repo = self.get_service(project_id)
        try:
            content = service.get_file_content(repo.owner, repo.repo_name, path, ref=ref)
            return Response(content)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class GitHubCreateBranchView(GitHubBaseView):
    """
    Create a new branch in the repository.
    """
    def post(self, request, project_id):
        branch_name = request.data.get("branch_name")
        base_sha = request.data.get("base_sha")
        print(f"Creating branch: {branch_name} from {base_sha}")
        
        if not branch_name or not base_sha:
            return Response({"error": "branch_name and base_sha are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        service, repo = self.get_service(project_id)
        try:
            result = service.create_branch(repo.owner, repo.repo_name, branch_name, base_sha)
            return Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)



def _reindex_default_branch_async(service, repo, project_id, user):
    """
    After a PR merge, re-download and re-index the default branch in a
    background thread so the AI's codebase context stays up to date.
    Failures are silent — this is best-effort.
    """
    import threading
    from apps.projects.services import save_code_zip_and_extract
    from apps.projects.models import Project
    from django.core.files.base import ContentFile

    def _run():
        try:
            project = Project.objects.get(id=project_id)
            branch = (repo.default_branch or "main").strip()
            zip_content = service.download_zipball(repo.owner, repo.repo_name, branch)
            zip_file = ContentFile(zip_content, name=f"{repo.repo_name}-{branch}.zip")
            save_code_zip_and_extract(project, zip_file, user)
        except Exception:
            pass

    threading.Thread(target=_run, daemon=True).start()
class GitHubMergePullRequestView(GitHubBaseView):
    """
    Merge a pull request.
    """
    def post(self, request, project_id, pr_number):
        commit_title = request.data.get("commit_title")
        commit_message = request.data.get("commit_message")
        
        service, repo = self.get_service(project_id)
        try:
            result = service.merge_pull_request(
                repo.owner, 
                repo.repo_name, 
                pr_number, 
                commit_title=commit_title, 
                commit_message=commit_message
            )
            _reindex_default_branch_async(service, repo, project_id, request.user)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class GitHubFetchAndIndexView(GitHubBaseView):
    """
    Fetch the entire repository branch and index it.
    """
    def post(self, request, project_id):
        branch = request.data.get("branch", "main")
        service, repo = self.get_service(project_id)
        project = repo.project
        
        try:
            # Download the zip archive
            zip_content = service.download_zipball(repo.owner, repo.repo_name, branch)
            
            # Wrap raw bytes in a ContentFile so Django can save it
            file_name = f"{repo.repo_name}-{branch}.zip"
            zip_file = ContentFile(zip_content, name=file_name)
            
            # Index it just like an uploaded zip
            save_code_zip_and_extract(project, zip_file, request.user)
            
            return Response({"message": f"Successfully fetched and indexed branch '{branch}'"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
