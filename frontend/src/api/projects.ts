// frontend/src/api/projects.ts
import { apiGet, apiPost, apiUpload } from "./http";
import type { ProjectDetailApi, ProjectSummaryApi } from "./types";

export function fetchProjects() {
  return apiGet<ProjectSummaryApi[]>("/api/projects/");
}

export function createProject(input: {
  name: string;
  description?: string;
  similarity_threshold: number;
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
  return apiGet<{ project_id: number; files: Array<{ relative_path: string; ext: string; size_bytes: number }> }>(
    `/api/projects/${projectId}/files/`
  );
}

export function fetchTasks(projectId: number) {
  return apiGet<{ project_id: number; tasks: Array<{ task_id: string; name: string; description: string }> }>(
    `/api/projects/${projectId}/tasks/`
  );
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
