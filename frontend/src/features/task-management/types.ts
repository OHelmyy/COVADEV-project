export type AssignmentStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_CHANGES"
  | "ACCEPTED"
  | "REJECTED"
  | "MERGED";

export type AiSuitability =
  | "RECOMMENDED"
  | "NEUTRAL"
  | "NOT_RECOMMENDED"
  | "UNKNOWN";

export type TimeTrackingStatus =
  | "NO_ESTIMATE"
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "NO_ACTUAL_TIME"
  | "COMPLETED_EARLY"
  | "ON_TIME"
  | "SLIGHTLY_OVER"
  | "OVER_ESTIMATE";

export type EstimatedDurationSource =
  | "AI"
  | "FALLBACK"
  | "MANUAL"
  | string;

export type TimeTracking = {
  estimatedMinutes?: number | null;
  estimatedLabel?: string | null;
  estimatedSource?: EstimatedDurationSource | null;
  estimatedReason?: string;
  actualMinutes?: number | null;
  actualLabel?: string | null;
  differenceMinutes?: number | null;
  differenceLabel?: string | null;
  status: TimeTrackingStatus;
  startedAt?: string | null;
  submittedAt?: string | null;
};

export type Developer = {
  membershipId: number;
  userId: number;
  username: string;
  email: string;
  role: string;
  isAiAgent?: boolean;
};

export type AssignmentDeveloper = {
  membershipId: number;
  userId: number;
  username: string;
  email: string;
  role: string;
  isAiAgent?: boolean;
};

export type TaskInfo = {
  id: number;
  taskId: string;
  name: string;
  description?: string;
  summaryText?: string;

  estimatedDurationMinutes?: number | null;
  estimatedDurationLabel?: string | null;
  estimatedDurationSource?: EstimatedDurationSource | null;
  estimatedDurationReason?: string;

  aiSuitability?: AiSuitability;
  aiSuitabilityReason?: string;
  aiSuitabilityCheckedAt?: string | null;
};

export type TaskEvaluation = {
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
  evaluatedAt?: string | null;
};

export type Assignment = {
  assignmentId: number;
  projectId: number;
  status: AssignmentStatus;

  assignmentNotes?: string;
  submissionNotes?: string;
  reviewNotes?: string;

  githubBranch?: string;
  githubPrNumber?: number | null;
  githubPrUrl?: string;

  assignedAt?: string | null;
  startedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;

  timeTracking?: TimeTracking;

  assignedBy?: {
    id: number;
    username: string;
  } | null;

  reviewedBy?: {
    id: number;
    username: string;
  } | null;

  task?: TaskInfo;
  developer?: AssignmentDeveloper;
  evaluation?: TaskEvaluation | null;

  aiRetryCount?: number;
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

export type AssignmentWithTask = {
  assignmentId: number;
  projectId: number;
  projectName?: string;

  status: AssignmentStatus;

  assignmentNotes?: string;
  submissionNotes?: string;
  reviewNotes?: string;

  githubBranch?: string;
  githubPrNumber?: number | null;
  githubPrUrl?: string;

  assignedAt?: string | null;
  startedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;

  timeTracking?: TimeTracking;

  taskName?: string;
  taskId?: string;
  taskDescription?: string;
  task: TaskInfo;

  developer?: AssignmentDeveloper;
  evaluation?: TaskEvaluation | null;
};

export type MyAssignmentsResponse = {
  items: AssignmentWithTask[];
};

export type DeveloperPerformanceItem = {
  membershipId: number;
  userId: number;
  username: string;
  email: string;
  totalAssigned: number;
  acceptedCount: number;
  rejectedCount: number;
  submittedCount: number;
  inProgressCount: number;
  acceptanceRate: number;
  averageScore: number;
};

export type AiGeneratedFileItem = {
  id: number;
  filename: string;
  language: string;
  content: string;
};

export type AiSubmissionItem = {
  id: number;
  attemptNumber: number;
  explanation: string;
  modelUsed: string;
  tokensUsed: number;
  createdAt: string | null;
  files: AiGeneratedFileItem[];
};

export type AiSubmissionResponse = {
  assignmentId: number;
  isAiAgent: boolean;
  status:
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "SUBMITTED"
    | "ACCEPTED"
    | "REJECTED";

  task: TaskInfo;

  latest: AiSubmissionItem | null;
  history: AiSubmissionItem[];
  retryCount: number;
};

export type AiRunItem = {
  submissionId: number;
  assignmentId: number;
  taskId: number;
  taskName: string;
  taskStatus:
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "SUBMITTED"
    | "ACCEPTED"
    | "REJECTED";

  attemptNumber: number;
  modelUsed: string;
  tokensUsed: number;
  fileCount: number;
  createdAt: string | null;
  aiRetryCount: number;

  timeTracking?: TimeTracking;
};

export type AiRunsResponse = {
  projectId: number;
  totalRuns: number;
  totals: {
    submitted: number;
    accepted: number;
    rejected: number;
    assigned: number;
    inProgress: number;
  };
  items: AiRunItem[];
};