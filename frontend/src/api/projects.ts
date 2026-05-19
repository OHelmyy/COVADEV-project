// frontend/src/api/projects.ts

import { apiGet, apiPost, apiUpload, apiDelete, apiPostJson } from "./http";
import type { ProjectDetailApi, ProjectSummaryApi } from "./types";

export function fetchProjects() {
  return apiGet<ProjectSummaryApi[]>("/api/projects/");
}

export function createProject(input: {
  name: string;
  description?: string;
  similarity_threshold: number;
  github_repo_url?: string;

  // ✅ added for Admin create (backend expects these)
  evaluatorEmail: string;
  developerEmails?: string; // comma-separated
}) {
  return apiPost<ProjectSummaryApi>("/api/projects/", input);
}

export function fetchProjectDetail(projectId: number) {
  return apiGet<ProjectDetailApi>(`/api/projects/${projectId}/`);
}

export function updateThreshold(projectId: number, similarityThreshold: number) {
  return apiPostJson<{ ok: boolean; similarityThreshold: number }>(
    `/api/projects/${projectId}/settings/threshold/`,
    { similarityThreshold }
  );
}

export function addMember(projectId: number, email: string) {
  return apiPost<{ id: number; username: string; email: string; role: string }>(
    `/api/projects/${projectId}/members/`,
    { email }
  );
}

export function removeMember(projectId: number, membershipId: number) {
  return apiPost<{ ok: boolean }>(
    `/api/projects/${projectId}/members/${membershipId}/remove/`,
    {}
  );
}

export function uploadBpmn(projectId: number, file: File) {
  const fd = new FormData();
  fd.append("bpmn_file", file);
  return apiUpload<{
    ok: boolean;
    isWellFormed?: boolean;
    precheckWarnings?: string[];
    precheckErrors?: string[];
    bpmnSummary?: string;
  }>(`/api/projects/${projectId}/upload-bpmn/`, fd);
}

export function uploadCodeZip(projectId: number, file: File) {
  const fd = new FormData();
  fd.append("code_zip", file);
  return apiUpload<{ ok: boolean }>(`/api/projects/${projectId}/upload-code/`, fd);
}

export function runAnalysis(projectId: number) {
  return apiPost<{ run: { id: number; status: string; errorMessage?: string | null } }>(
    `/api/projects/${projectId}/run-analysis/`,
    {}
  );
}

export function fetchGithubCode(projectId: number, branch: string) {
  return apiPost<{ ok: boolean }>(`/api/projects/${projectId}/fetch-github/`, {
    branch,
  });
}

export function updateGithubUrl(projectId: number, githubRepoUrl: string) {
  return apiPostJson<{ ok: boolean }>(
    `/api/projects/${projectId}/settings/github-url/`,
    { github_repo_url: githubRepoUrl }
  );
}

export function fetchFiles(projectId: number) {
  return apiGet<{
    project_id: number;
    files: Array<{ relative_path: string; ext: string; size_bytes: number }>;
  }>(`/api/projects/${projectId}/files/`);
}

export function fetchTasks(projectId: number) {
  return apiGet<{
    project_id: number;
    tasks: Array<{ task_id: string; name: string; description: string }>;
  }>(`/api/projects/${projectId}/tasks/`);
}

export function fetchMatches(projectId: number) {
  return apiGet<{
    project_id: number;
    matches: Array<{
      status: string;
      similarity_score: number;
      task: null | { task_id: string; name: string };
      code_ref: string;
    }>;
  }>(`/api/projects/${projectId}/matches/`);
}

export function fetchLogs(projectId: number) {
  return apiGet<{
    projectId: number;
    logs: Array<{
      id: number;
      fileType: string;
      originalName: string;
      uploadedBy: string | null;
      createdAt: string;
    }>;
  }>(`/api/projects/${projectId}/logs/`);
}

export function deleteProject(projectId: number) {
  return apiDelete<{ ok: true }>(`/api/projects/${projectId}/`);
}

/**
 * ✅ Compare Inputs endpoint
 * Backend route is:
 *   config/urls.py -> path("analysis/", include("apps.analysis.urls"))
 *   apps/analysis/urls.py -> path("api/analysis/<int:project_id>/compare-inputs/", ...)
 *
 * So full URL is:
 *   /analysis/api/analysis/<projectId>/compare-inputs/
 */
export async function fetchCompareInputs(projectId: number) {
  const res = await apiGet<{
    projectId: number;
    bpmnTasks: Array<{
      taskId: string;
      name: string;
      description?: string;
      compareText?: string;
      summaryText?: string;
    }>;
    codeFunctions: Array<{
      codeUid: string;
      file?: string;
      filePath?: string;
      symbol?: string;
      functionName?: string;
      summary?: string;
      summary_text?: string;
      summaryText?: string;
      compareText?: string;
      source?: "evaluator" | "ai";
    }>;
  }>(`/api/projects/${projectId}/compare-inputs/`); // ✅ FIXED URL

  return {
    projectId: res.projectId,

    bpmnTasks: (res.bpmnTasks ?? []).map((t) => {
      const name = (t.name ?? "").trim() || "Unnamed Task";
      const desc = (t.description ?? "").trim();

      const summaryText =
        (t.summaryText ?? "").trim() ||
        (t.compareText ?? "").trim() ||
        `Task: ${name}. Description: ${desc}`.trim();

      return {
        taskId: t.taskId,
        name,
        description: desc,
        summaryText,
      };
    }),

    codeFunctions: (res.codeFunctions ?? []).map((c) => {
      const fnName =
        (c.functionName ?? "").trim() ||
        (c.symbol ?? "").trim() ||
        "Unnamed Function";

      const fp =
        (c.filePath ?? "").trim() ||
        (c.file ?? "").trim() ||
        "";

      const sumRaw =
        (c.summaryText ?? "").trim() ||
        (c.summary_text ?? "").trim() ||
        (c.summary ?? "").trim();
      return {
        codeUid: c.codeUid,
        functionName: fnName,
        filePath: fp,
        summaryText: sumRaw,
        source: c.source,
      };
    }),
  };
}


export function fetchRecommendations(projectId: number) {
  return apiGet<{
    projectId: number;
    hasSummary: boolean;
    recommendations: string[];
    updatedAt: string | null;
  }>(`/api/projects/${projectId}/recommendations/`);
}

export function generateRecommendations(projectId: number) {
  return apiPost<{
    ok: boolean;
    recommendations: string[];
    updatedAt: string;
  }>(`/api/projects/${projectId}/recommendations/`, {});
}

// ─── Developer Submission endpoints ───────────────────────────────────────────

export type MyTask = {
  assignmentId: number;
  taskId: string;
  taskName: string;
  taskDescription: string;
  assignmentStatus: string;
  submission: {
    id: number;
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "REASSIGNED";
    attemptNumber: number;
    feedback: string;
    submittedAt: string;
  } | null;
};

export type SubmissionAttempt = {
  id: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "REASSIGNED";
  attemptNumber: number;
  feedback: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  zipFileName: string | null;
  zipUrl: string | null;
  hasFiles: boolean;
  similarityScore: number | null;
};

export type DevSubmission = {
  assignmentId: number;
  taskId: string;
  taskName: string;
  taskDescription: string;
  developerEmail: string;
  developerName: string;
  assignmentStatus: string;
  latestStatus: "PENDING" | "ACCEPTED" | "REJECTED" | "REASSIGNED";
  totalAttempts: number;
  attempts: SubmissionAttempt[];
};

export type FileTreeNode = {
  type: "file" | "dir";
  name: string;
  path?: string;
  previewable?: boolean;
  children?: Record<string, FileTreeNode>;
};

export function fetchMyTasks(projectId: number) {
  return apiGet<{ tasks: MyTask[] }>(`/api/projects/${projectId}/my-tasks/`);
}

export function submitZip(projectId: number, assignmentId: number, file: File) {
  const fd = new FormData();
  fd.append("zip_file", file);
  return apiUpload<{ ok: boolean; submissionId: number }>(
    `/api/projects/${projectId}/my-tasks/${assignmentId}/submit/`,
    fd
  );
}

export function fetchDevSubmissions(projectId: number) {
  return apiGet<{ submissions: DevSubmission[] }>(
    `/api/projects/${projectId}/developer-submissions/`
  );
}

export function acceptSubmission(projectId: number, submissionId: number) {
  return apiPostJson<{ ok: boolean; belowThreshold?: boolean; similarity?: number; threshold?: number; detail?: string }>(
    `/api/projects/${projectId}/developer-submissions/${submissionId}/accept/`,
    {}
  );
}

export function rejectSubmission(projectId: number, submissionId: number, feedback: string) {
  return apiPostJson<{ ok: boolean }>(
    `/api/projects/${projectId}/developer-submissions/${submissionId}/reject/`,
    { feedback }
  );
}

export function reassignSubmission(projectId: number, submissionId: number, feedback: string) {
  return apiPostJson<{ ok: boolean }>(
    `/api/projects/${projectId}/developer-submissions/${submissionId}/reassign/`,
    { feedback }
  );
}

export function fetchSubmissionFileTree(projectId: number, submissionId: number) {
  return apiGet<{
    submissionId: number;
    totalFiles: number;
    tree: Record<string, FileTreeNode>;
  }>(`/api/projects/${projectId}/developer-submissions/${submissionId}/files/`);
}

export function fetchSubmissionFileContent(projectId: number, submissionId: number, path: string) {
  return apiGet<{
    path: string;
    content: string;
    truncated: boolean;
    language: string;
  }>(`/api/projects/${projectId}/developer-submissions/${submissionId}/file-content/?path=${encodeURIComponent(path)}`);
}


export function acceptGitHubPR(
  projectId: number,
  prNumber: number,
  commitTitle?: string,
) {
  return apiPostJson<{
    ok: boolean;
    belowThreshold?: boolean;
    similarity?: number;
    threshold?: number;
    detail?: string;
    matchStatus?: string;
  }>(`/api/projects/${projectId}/github-pr/accept/`, {
    pr_number: prNumber,
    commit_title: commitTitle ?? `Merge PR #${prNumber}`,
  });
}