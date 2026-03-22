export type Developer = {
  membershipId: number;
  userId: number;
  username: string;
  email: string;
  role: string;
};

export type AssignmentDeveloper = {
  membershipId: number;
  userId: number;
  username: string;
  email: string;
  role: string;
};

export type TaskInfo = {
  id: number;
  taskId: string;
  name: string;
  description?: string;
};

export type Assignment = {
  assignmentId: number;
  projectId: number;
  status: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
  assignmentNotes?: string;
  submissionNotes?: string;
  reviewNotes?: string;
  assignedAt?: string | null;
  startedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  developer?: AssignmentDeveloper;
};

export type TaskAssignmentItem = {
  task: TaskInfo;
  assignment: Assignment | null;
};

export type DevelopersResponse = {
  projectId: number;
  developers: Developer[];
};

export type TaskAssignmentsResponse = {
  projectId: number;
  items: TaskAssignmentItem[];
};

export type MyAssignmentsResponse = {
  items: AssignmentWithTask[];
};

export type AssignmentWithTask = {
  assignmentId: number;
  projectId: number;
  status: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
  assignmentNotes?: string;
  submissionNotes?: string;
  reviewNotes?: string;
  assignedAt?: string | null;
  startedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  task: TaskInfo;
  developer?: AssignmentDeveloper;
};