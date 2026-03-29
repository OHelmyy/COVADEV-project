import { apiJson } from "../../../lib/api";
import type {
  DevelopersResponse,
  TaskAssignmentsResponse,
  MyAssignmentsResponse,
  DeveloperPerformanceItem,

} from "../types";

export function getProjectDevelopers(projectId: number) {
  return apiJson<DevelopersResponse>(`/api/projects/${projectId}/developers/`);
}

export function getProjectTaskAssignments(projectId: number) {
  return apiJson<TaskAssignmentsResponse>(
    `/api/projects/${projectId}/task-assignments/`
  );
}

export function assignTask(
  projectId: number,
  payload: {
    bpmnTaskId: number;
    developerMembershipId: number;
    notes?: string;
  }
) {
  return apiJson(`/api/projects/${projectId}/task-assignments/assign/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function reviewTaskAssignment(
  assignmentId: number,
  payload: {
    accepted: boolean;
    reviewNotes?: string;
  }
) {
  return apiJson(`/api/task-assignments/${assignmentId}/review/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMyTaskAssignments() {
  return apiJson<MyAssignmentsResponse>(`/api/task-assignments/my/`);
}

export function startTaskAssignment(assignmentId: number) {
  return apiJson(`/api/task-assignments/${assignmentId}/start/`, {
    method: "POST",
  });
}

export function submitTaskAssignment(
  assignmentId: number,
  payload: {
    submissionNotes?: string;
  }
) {
  return apiJson(`/api/task-assignments/${assignmentId}/submit/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export function evaluateTaskAssignment(
  assignmentId: number,
  payload: {
    correctnessScore: number;
    qualityScore: number;
    timelinessScore: number;
    communicationScore: number;
    comments?: string;
  }
) {
  return apiJson(`/api/task-assignments/${assignmentId}/evaluate/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getProjectDeveloperPerformance(projectId: number) {
  return apiJson<{ projectId: number; items: DeveloperPerformanceItem[] }>(
    `/api/projects/${projectId}/developer-performance/`
  );
}


export type DeveloperPerformanceOverviewItem = {
  userId: number;
  username: string;
  email: string;
  projectsCount: number;
  totalAssigned: number;
  acceptedCount: number;
  rejectedCount: number;
  submittedCount: number;
  inProgressCount: number;
  acceptanceRate: number;
  averageScore: number;
};

export function getDeveloperPerformanceOverview() {
  return apiJson<{ items: DeveloperPerformanceOverviewItem[] }>(
    "/api/task-management/developer-performance/"
  );
}

  