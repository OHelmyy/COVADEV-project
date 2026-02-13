// frontend/src/api/types.ts

// --------------------
// Shared
// --------------------
export type ProjectRole = "EVALUATOR" | "DEVELOPER" | string;

// --------------------
// Projects API (from /api/projects/...)
// --------------------
export type ProjectSummaryApi = {
  id: number;
  name: string;
  description?: string;
  similarityThreshold: number;
  membership?: { role: ProjectRole };
};

export type ProjectDetailApi = {
  project: {
    id: number;
    name: string;
    description: string;
    similarityThreshold: number;
  };
  membership: { role: ProjectRole };

  activeUploads: {
    activeBpmn: null | { id: number; originalName: string; createdAt: string; uploadedBy: string | null };
    activeCode: null | { id: number; originalName: string; createdAt: string; uploadedBy: string | null };
    latestBpmn: null | { id: number; originalName: string; createdAt: string; uploadedBy: string | null };
    latestCode: null | { id: number; originalName: string; createdAt: string; uploadedBy: string | null };
  };

  counts: { codeFiles: number; tasks: number; matches: number };

  runs: Array<{
    id: number;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string | null;
    errorMessage: string | null;
  }>;

  members: Array<{
    id: number;
    username: string;
    email: string;
    role: ProjectRole;
  }>;
};

// --------------------
// Dashboard (from /api/reports/dashboard/)
// --------------------
export type AnalysisStatus = "pending" | "done";

export type DashboardProjectSummary = {
  id: string;
  name: string;
  status: AnalysisStatus; // "pending" | "done"
  updatedAt: string;      // ISO string
};

export type DashboardStats = {
  totalProjects: number;
  totalUploads: number;
  analysesPending: number;
  analysesDone: number;
  recentProjects: DashboardProjectSummary[];
};
