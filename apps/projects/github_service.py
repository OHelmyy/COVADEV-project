# apps/projects/github_service.py
"""
GitHub integration service for fetching public repository archives.

Supports downloading a specific branch as a ZIP archive using GitHub's
public archive endpoint — no API tokens or git installation required.
"""
from __future__ import annotations

import re
import tempfile
import urllib.request
import urllib.error
from pathlib import Path
from typing import Tuple

from django.conf import settings


# ============================================================
# URL validation
# ============================================================

_GITHUB_URL_RE = re.compile(
    r"^https?://github\.com/(?P<owner>[A-Za-z0-9_.\-]+)/(?P<repo>[A-Za-z0-9_.\-]+?)(?:\.git)?/?$"
)


def validate_github_url(url: str) -> Tuple[str, str]:
    """
    Parse and validate a GitHub repository URL.

    Accepts forms like:
        https://github.com/owner/repo
        https://github.com/owner/repo.git
        https://github.com/owner/repo/

    Returns:
        (owner, repo) tuple.

    Raises:
        ValueError if the URL is not a valid GitHub repo URL.
    """
    url = (url or "").strip()
    if not url:
        raise ValueError("GitHub URL is required.")

    m = _GITHUB_URL_RE.match(url)
    if not m:
        raise ValueError(
            "Invalid GitHub URL. Expected format: https://github.com/owner/repo"
        )

    return m.group("owner"), m.group("repo")


# ============================================================
# Archive download
# ============================================================

def download_repo_archive(
    repo_url: str,
    project_id: int,
    branch: str = "main",
) -> Path:
    """
    Download a GitHub repo archive (ZIP) for the given branch.

    Uses the public endpoint:
        https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip

    The ZIP is saved to:
        media/projects/<project_id>/code/<repo>-<branch>.zip

    Returns:
        Absolute Path to the downloaded ZIP file.

    Raises:
        ValueError  – bad URL or branch name.
        RuntimeError – download / network failure.
    """
    owner, repo = validate_github_url(repo_url)
    branch = (branch or "main").strip() or "main"

    # Sanitise branch for filename (replace / with -)
    safe_branch = branch.replace("/", "-")

    archive_url = (
        f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip"
    )

    # Destination directory
    dest_dir = Path(settings.MEDIA_ROOT) / "projects" / str(project_id) / "code"
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest_file = dest_dir / f"{repo}-{safe_branch}.zip"

    try:
        # Download with a generous timeout
        req = urllib.request.Request(archive_url, headers={"User-Agent": "COVADEV/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            dest_file.write_bytes(resp.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise RuntimeError(
                f"Repository or branch not found: {owner}/{repo} (branch: {branch}). "
                f"Make sure the repo is public and the branch exists."
            ) from e
        raise RuntimeError(f"GitHub download failed (HTTP {e.code}): {e.reason}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error downloading from GitHub: {e.reason}") from e

    if not dest_file.exists() or dest_file.stat().st_size == 0:
        raise RuntimeError("Downloaded archive is empty — check the repo URL and branch.")

    return dest_file
