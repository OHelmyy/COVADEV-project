import { apiGet } from "./http";
import type { ProjectSummary } from "./types";

// Helmy can implement this endpoint in Django
export function fetchProjects() {
  return apiGet<ProjectSummary[]>("/api/projects/");
}
