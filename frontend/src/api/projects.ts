// frontend/src/api/projects.ts
import { apiGet, apiPost, apiUpload, apiDelete } from "./http";
import type { ProjectDetailApi, ProjectSummaryApi } from "./types";

export function fetchProjects() {
  return apiGet<ProjectSummaryApi[]>("/api/projects/");
}

export function createProject(input: {
  name: string;
  description?: string;
  similarity_threshold: number;

  // ✅ added for Admin create (backend expects these)
  evaluatorEmail: string;
  developerEmails?: string; // comma-separated
}) {
  return apiPost<ProjectSummaryApi>("/api/projects/", input);
}

export function fetchProjectDetail(projectId: number) {
  return apiGet<ProjectDetailApi>(`/api/projects/${projectId}/`);
}

export function updateThreshold(projectId: number, similarity_threshold: number) {
  return apiPost<{ ok: boolean; similarityThreshold: number }>(
    `/api/projects/${projectId}/settings/threshold/`,
    { similarity_threshold }
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
  return apiUpload<{ ok: boolean }>(`/api/projects/${projectId}/upload-bpmn/`, fd);
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
      structured_summary?: string;
      structuredSummary?: string;
      compareText?: string;
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

      const structured =
        (c.structuredSummary ?? "").trim() ||
        (c.structured_summary ?? "").trim();

      return {
        codeUid: c.codeUid,
        functionName: fnName,
        filePath: fp,
        summaryText: sumRaw,
        structuredSummary: structured,
      };
    }),
  };
}
