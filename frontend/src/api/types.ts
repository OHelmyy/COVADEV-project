export type AnalysisStatus = "pending" | "done";

export type ProjectSummary = {
  id: string;
  name: string;
  status: AnalysisStatus;   // pending | done
  updatedAt: string;        // ISO date string
};

export type DashboardStats = {
  totalProjects: number;
  totalUploads: number;
  analysesPending: number;
  analysesDone: number;
  recentProjects: ProjectSummary[];
};
