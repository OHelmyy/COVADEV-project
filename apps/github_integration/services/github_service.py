import requests
from django.conf import settings

class GitHubService:
    """
    Service layer for interacting with the GitHub API.
    """

    BASE_URL = "https://api.github.com"

    def __init__(self, token=None):
        self.token = token
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
        }
        if token:
            self.headers["Authorization"] = f"token {token}"

    def _get(self, endpoint, params=None):
        url = f"{self.BASE_URL}/{endpoint}"
        response = requests.get(url, headers=self.headers, params=params)
        
        if response.status_code == 401:
            raise Exception("Invalid GitHub token or unauthorized.")
        if response.status_code == 404:
            raise Exception("Resource not found on GitHub.")
        if response.status_code == 403 and "rate limit" in response.text.lower():
            raise Exception("GitHub API rate limit exceeded.")
            
        response.raise_for_status()
        return response.json()

    def test_connection(self, owner, repo):
        """
        Tests connection to a repository.
        Returns repository data if successful.
        """
        try:
            return self._get(f"repos/{owner}/{repo}")
        except Exception as e:
            raise Exception(f"Failed to connect to repository: {str(e)}")

    def get_branches(self, owner, repo):
        """
        Fetches all branches for a repository.
        """
        return self._get(f"repos/{owner}/{repo}/branches")

    def get_pull_requests(self, owner, repo, state="open"):
        """
        Fetches pull requests for a repository.
        """
        params = {"state": state}
        return self._get(f"repos/{owner}/{repo}/pulls", params=params)

    def get_pull_request(self, owner, repo, pr_number):
        """
        Fetches a specific pull request.
        """
        return self._get(f"repos/{owner}/{repo}/pulls/{pr_number}")

    def get_pull_request_files(self, owner, repo, pr_number):
        """
        Fetches files changed in a pull request.
        """
        return self._get(f"repos/{owner}/{repo}/pulls/{pr_number}/files")

    def get_pull_request_commits(self, owner, repo, pr_number):
        """
        Fetches commits in a pull request.
        """
        return self._get(f"repos/{owner}/{repo}/pulls/{pr_number}/commits")

    def get_file_content(self, owner, repo, path, ref=None):
        """
        Fetches content of a file.
        ref can be a branch name, tag, or commit SHA.
        """
        params = {}
        if ref:
            params["ref"] = ref
        
        # GitHub API returns content as base64
        data = self._get(f"repos/{owner}/{repo}/contents/{path}", params=params)
        
        if isinstance(data, list):
            raise Exception("Path is a directory, not a file.")
            
        import base64
        if data.get("encoding") == "base64":
            content = base64.b64decode(data["content"]).decode("utf-8")
            return {
                "content": content,
                "name": data["name"],
                "path": data["path"],
                "sha": data["sha"],
                "size": data["size"]
            }
        return data

    def get_branch(self, owner, repo, branch_name):
        """
        Fetches details of a specific branch.
        """
        return self._get(f"repos/{owner}/{repo}/branches/{branch_name}")

    def create_branch(self, owner, repo, branch_name, base_sha):
        """
        Creates a new branch from a base SHA.
        """
        url = f"{self.BASE_URL}/repos/{owner}/{repo}/git/refs"
        data = {
            "ref": f"refs/heads/{branch_name}",
            "sha": base_sha
        }
        response = requests.post(url, headers=self.headers, json=data)
        
        if response.status_code != 201:
            error_data = response.json()
            message = error_data.get("message", "Unknown error")
            raise Exception(f"GitHub Error: {message} (Branch: {branch_name})")
            
        return response.json()

    def merge_pull_request(self, owner, repo, pr_number, commit_title=None, commit_message=None):
        """
        Merges a pull request.
        """
        url = f"{self.BASE_URL}/repos/{owner}/{repo}/pulls/{pr_number}/merge"
        data = {}
        if commit_title:
            data["commit_title"] = commit_title
        if commit_message:
            data["commit_message"] = commit_message
            
        response = requests.put(url, headers=self.headers, json=data)
        if response.status_code != 200:
            error_data = response.json()
            message = error_data.get("message", "Unknown error")
            raise Exception(f"GitHub Error: {message}")
            
        return response.json()
