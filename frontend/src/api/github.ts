// frontend/src/api/github.ts

import { apiGet, apiPostJson } from "./http";

export type GitHubRepoApi = {
  id: number;
  project: number;
  owner: string;
  repo_name: string;
  default_branch: string;
  github_url: string;
  is_connected: boolean;
  created_at: string;
  updated_at: string;
};

export type GitHubBranchApi = {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
};

export type GitHubPullRequestApi = {
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  head: {
    label: string;
    ref: string;
    sha: string;
  };
  base: {
    label: string;
    ref: string;
    sha: string;
  };
};

export type GitHubFileApi = {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch?: string;
};

export type GitHubCommitApi = {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
};

export type GitHubFileContentApi = {
  content: string;
  name: string;
  path: string;
  sha: string;
  size: number;
};

export function connectGitHub(projectId: number, data: {
  owner: string;
  repo_name: string;
  access_token: string;
  default_branch?: string;
}) {
  return apiPostJson<GitHubRepoApi>(`/api/projects/${projectId}/github/connect/`, data);
}

export function fetchGitHubRepo(projectId: number) {
  return apiGet<GitHubRepoApi>(`/api/projects/${projectId}/github/repository/`);
}

export function fetchGitHubBranches(projectId: number) {
  return apiGet<GitHubBranchApi[]>(`/api/projects/${projectId}/github/branches/`);
}

export function createGitHubBranch(projectId: number, branchName: string, baseSha: string) {
  return apiPostJson<{ ref: string; node_id: string; url: string; object: { sha: string; type: string; url: string } }>(
    `/api/projects/${projectId}/github/branches/create/`,
    { branch_name: branchName, base_sha: baseSha }
  );
}


export function fetchGitHubPullRequests(projectId: number, state: string = "open") {
  return apiGet<GitHubPullRequestApi[]>(`/api/projects/${projectId}/github/pull-requests/?state=${state}`);
}

export function fetchGitHubPullRequest(projectId: number, prNumber: number) {
  return apiGet<GitHubPullRequestApi>(`/api/projects/${projectId}/github/pull-requests/${prNumber}/`);
}

export function fetchGitHubPullRequestFiles(projectId: number, prNumber: number) {
  return apiGet<GitHubFileApi[]>(`/api/projects/${projectId}/github/pull-requests/${prNumber}/files/`);
}

export function fetchGitHubPullRequestCommits(projectId: number, prNumber: number) {
  return apiGet<GitHubCommitApi[]>(`/api/projects/${projectId}/github/pull-requests/${prNumber}/commits/`);
}

export function fetchGitHubFileContent(projectId: number, path: string, ref?: string) {
  let url = `/api/projects/${projectId}/github/file-content/?path=${encodeURIComponent(path)}`;
  if (ref) {
    url += `&ref=${encodeURIComponent(ref)}`;
  }
  return apiGet<GitHubFileContentApi>(url);
}

export function mergeGitHubPullRequest(projectId: number, prNumber: number, data?: { commit_title?: string; commit_message?: string }) {
  return apiPostJson<any>(`/api/projects/${projectId}/github/pull-requests/${prNumber}/merge/`, data || {});
}
