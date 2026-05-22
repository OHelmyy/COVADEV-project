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

    def download_zipball(self, owner, repo, ref):
        """
        Downloads the repository archive as a zipball for the given ref.
        Returns raw bytes.
        """
        from urllib.parse import quote
        # URL-encode the ref so slashes in branch names (e.g. task/foo) don't
        # break the URL path segment.
        encoded_ref = quote(ref, safe="")
        url = f"{self.BASE_URL}/repos/{owner}/{repo}/zipball/{encoded_ref}"
        # GitHub returns a redirect to S3; allow_redirects=True handles it.
        # Stream the response so large repos don't time out.
        response = requests.get(url, headers=self.headers, allow_redirects=True, stream=True)
        if response.status_code == 404:
            raise Exception(
                f"Branch '{ref}' not found on GitHub. "
                "Make sure you have pushed your branch before previewing."
            )
        if response.status_code != 200:
            raise Exception(f"Failed to download repository zip archive. Status code: {response.status_code}")
        return response.content

    def push_files_to_branch(self, owner, repo, branch, files, commit_message):
        """
        Pushes multiple files to an existing branch using the Git Data API.

        files: list of dicts with keys 'path' (str) and 'content' (str).
        Uses a single commit: get branch tip → create tree → create commit → update ref.
        Returns the new commit data.
        """
        import base64

        # 1. Get the latest commit SHA on the branch
        ref_data = self._get(f"repos/{owner}/{repo}/git/refs/heads/{branch}")
        latest_commit_sha = ref_data["object"]["sha"]

        # 2. Get the tree SHA for that commit
        commit_data = self._get(f"repos/{owner}/{repo}/git/commits/{latest_commit_sha}")
        base_tree_sha = commit_data["tree"]["sha"]

        # 3. Build a new tree with all generated files (mode 100644 = regular file)
        tree_items = []
        for f in files:
            content = f["content"]
            # Encode content as base64 blob then create blob object
            blob_url = f"{self.BASE_URL}/repos/{owner}/{repo}/git/blobs"
            blob_resp = requests.post(
                blob_url,
                headers=self.headers,
                json={
                    "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
                    "encoding": "base64",
                },
            )
            if blob_resp.status_code != 201:
                raise Exception(f"Failed to create blob for {f['path']}: {blob_resp.text}")
            blob_sha = blob_resp.json()["sha"]

            tree_items.append({
                "path": f["path"],
                "mode": "100644",
                "type": "blob",
                "sha": blob_sha,
            })

        # 4. Create the new tree
        tree_url = f"{self.BASE_URL}/repos/{owner}/{repo}/git/trees"
        tree_resp = requests.post(
            tree_url,
            headers=self.headers,
            json={"base_tree": base_tree_sha, "tree": tree_items},
        )
        if tree_resp.status_code != 201:
            raise Exception(f"Failed to create Git tree: {tree_resp.text}")
        new_tree_sha = tree_resp.json()["sha"]

        # 5. Create the commit
        commit_url = f"{self.BASE_URL}/repos/{owner}/{repo}/git/commits"
        commit_resp = requests.post(
            commit_url,
            headers=self.headers,
            json={
                "message": commit_message,
                "tree": new_tree_sha,
                "parents": [latest_commit_sha],
            },
        )
        if commit_resp.status_code != 201:
            raise Exception(f"Failed to create Git commit: {commit_resp.text}")
        new_commit_sha = commit_resp.json()["sha"]

        # 6. Update the branch ref to point to the new commit
        ref_url = f"{self.BASE_URL}/repos/{owner}/{repo}/git/refs/heads/{branch}"
        ref_resp = requests.patch(
            ref_url,
            headers=self.headers,
            json={"sha": new_commit_sha, "force": False},
        )
        if ref_resp.status_code != 200:
            raise Exception(f"Failed to update branch ref: {ref_resp.text}")

        return commit_resp.json()

    def create_pull_request(self, owner, repo, title, head, base, body=""):
        """
        Creates a pull request from head branch into base branch.
        Returns the PR data dict including 'number' and 'html_url'.
        """
        url = f"{self.BASE_URL}/repos/{owner}/{repo}/pulls"
        response = requests.post(
            url,
            headers=self.headers,
            json={
                "title": title,
                "head": head,
                "base": base,
                "body": body,
            },
        )
        if response.status_code != 201:
            error_data = response.json()
            message = error_data.get("message", "Unknown error")
            errors = error_data.get("errors", [])
            # If a PR already exists for this branch, surface a clear message
            if errors and any("already exists" in str(e).lower() for e in errors):
                raise Exception(f"A pull request for branch '{head}' already exists.")
            raise Exception(f"Failed to create pull request: {message}")
        return response.json()

