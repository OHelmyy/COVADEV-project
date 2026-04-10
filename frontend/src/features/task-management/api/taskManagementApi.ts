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

export type MyPerformanceProjectItem = {
  projectId: number;
  projectName: string;
  totalAssigned: number;
  acceptedCount: number;
  rejectedCount: number;
  submittedCount: number;
  inProgressCount: number;
  acceptanceRate: number;
  averageScore: number;
};

export type MyPerformanceRecentAssignmentItem = {
  assignmentId: number;
  projectId: number;
  projectName: string;
  status: string;
  assignedAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  task: {
    id: number;
    taskId: string;
    name: string;
    description?: string;
  };
  evaluation: {
    id: number;
    evaluator?: {
      id: number;
      username: string;
    } | null;
    correctnessScore: number;
    qualityScore: number;
    timelinessScore: number;
    communicationScore: number;
    finalScore: number;
    comments: string;
    evaluatedAt: string | null;
  } | null;
};

export type DeveloperRankingItem = {
  rank: number;
  userId: number;
  username: string;
  email: string;
  projectsCount: number;
  totalAssigned: number;
  acceptedCount: number;
  acceptanceRate: number;
  averageScore: number;
};


export type MyPerformanceInsightsResponse = {
  summary: {
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
  projects: MyPerformanceProjectItem[];
  recentAssignments: MyPerformanceRecentAssignmentItem[];
  ranking: {
    myRank: DeveloperRankingItem | null;
    totalDevelopers: number;
    topDevelopers: DeveloperRankingItem[];
  };
  
};

export function getMyPerformanceInsights() {
  return apiJson<MyPerformanceInsightsResponse>("/api/task-management/my-insights/");
}
export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string | null;
  project: {
    id: number;
    name: string;
  } | null;
  assignmentId: number | null;
};

export type MyNotificationsResponse = {
  items: NotificationItem[];
  unreadCount: number;
};

export function getMyNotifications() {
  return apiJson<MyNotificationsResponse>("/api/task-management/my-notifications/");
}

export function markNotificationRead(notificationId: number) {
  return apiJson<{ message: string; notification: NotificationItem }>(
    `/api/task-management/notifications/${notificationId}/read/`,
    {
      method: "POST",
    }
  );
}

export function markAllNotificationsRead() {
  return apiJson<{ message: string }>(
    "/api/task-management/notifications/read-all/",
    {
      method: "POST",
    }
  );
}