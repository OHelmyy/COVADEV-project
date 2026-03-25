import { apiGet } from "./http";

export function fetchProjectReport(projectId: number) {
  return apiGet(`/api/projects/${projectId}/report/`);
}