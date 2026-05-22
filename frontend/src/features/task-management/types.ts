export type Developer = {
  membershipId: number;
  userId: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  isAiAgent?: boolean;
};

export type AssignmentDeveloper = {
  membershipId: number;
  userId: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  isAiAgent?: boolean;
};

export type TaskInfo = {
  id: number;
  taskId: string;
  name: string;
  description?: string;
  aiSuitability?: AiSuitability;
  aiSuitabilityReason?: string;
  aiSuitabilityCheckedAt?: string | null;
};

export type Assignment = {
  assignmentId: number;
  projectId: number;
  status: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_CHANGES" | "ACCEPTED" | "REJECTED" | "MERGED";
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

export type MyAssignmentsResponse = {
  items: AssignmentWithTask[];
};

export type AssignmentWithTask = {
  assignmentId: number;
  projectId: number;
  status: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_CHANGES" | "ACCEPTED" | "REJECTED" | "MERGED";
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
  task: TaskInfo;
  developer?: AssignmentDeveloper;
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
export type AiSuitability =
  | "RECOMMENDED"
  | "NEUTRAL"
  | "NOT_RECOMMENDED"
  | "UNKNOWN";


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
  status: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
  task: {
    id: number;
    name: string;
    description?: string;
  };
  latest: AiSubmissionItem | null;
  history: AiSubmissionItem[];
  retryCount: number;
};
export type AiRunItem = {
  submissionId: number;
  assignmentId: number;
  taskId: number;
  taskName: string;
  taskStatus: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
  attemptNumber: number;
  modelUsed: string;
  tokensUsed: number;
  fileCount: number;
  createdAt: string | null;
  aiRetryCount: number;
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