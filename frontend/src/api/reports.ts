import { apiGet } from "./http";

// DEPRECATED: This file is no longer used.
// ReportsPage.tsx now uses features/projects/api/projectReport.ts instead.
// Safe to delete.

export function fetchProjectReport(projectId: number) {
  return apiGet(`/api/projects/${projectId}/report/`);
}

