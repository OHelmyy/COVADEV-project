import { apiGet, apiPost } from "./http";

export type ProjectMember = {
  id: number;
  username: string;
  email: string;
  role: string;
};

export type ProjectMembersResponse = {
  projectId: number;
  members: ProjectMember[];
  evaluator?: {
    id: number;
    username: string | null;
    email: string | null;
  } | null;
};

export function fetchProjectMembers(projectId: number) {
  return apiGet<ProjectMembersResponse>(`/api/projects/${projectId}/members/`);
}

export function addProjectMember(projectId: number, email: string) {
  return apiPost<ProjectMember>(`/api/projects/${projectId}/members/`, { email });
}

export function removeProjectMember(projectId: number, membershipId: number) {
  return apiPost<{ ok: true }>(
    `/api/projects/${projectId}/members/${membershipId}/remove/`,
    {}
  );
}