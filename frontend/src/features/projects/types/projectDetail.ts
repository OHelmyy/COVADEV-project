import type { ProjectDetailApi } from "../../../api/types";

export type LoadState = "idle" | "loading" | "success" | "error";

export type TaskRow = {
  task_id: string;
  name: string;
  description?: string;
};

export type FileRow = {
  relative_path: string;
  ext: string;
  size_bytes: number;
};

export type MatchRow = {
  status: string;
  similarity_score: number;
  task: null | { task_id: string; name: string };
  code_ref: string;
};

export type CompareBpmnTask = {
  taskId: string;
  name: string;
  description?: string;
  summaryText?: string;
  compareText?: string;
};

export type CompareCodeFn = {
  codeUid: string;
  functionName?: string;
  filePath?: string;
  summaryText?: string;
  symbol?: string;
  file?: string;
  summary_text?: string;
  summary?: string;
  structuredSummary?: string;
};

export type TabKey =
  | "overview"
  | "uploads"
  | "results"
  | "recommendations"
  | "compare"
  | "runs"
  | "members"
  | "bpmnCheck"
  | "bpmnDiagram"
  | "taskManagement"
  | "report";

export type TraceRow = {
  taskId: string;
  taskName: string;
  bestMatch: string;
  similarity: number;
  developer: string;
  note?: string;
};

export type MissingTask = {
  taskId: string;
  taskName: string;
  reason: string;
};

export type ExtraCode = {
  id: string;
  file: string;
  symbol: string;
  developer: string;
  reason: string;
};

export type ReportPayload = {
  traceability: TraceRow[];
  missingTasks: MissingTask[];
  extraCode: ExtraCode[];
};

export type MissingResultRow = {
  task_id: string;
  name: string;
  reason: string;
};

export type ProjectTabItem = {
  key: TabKey;
  label: string;
  visible: boolean;
};

export type ProjectRoleFlags = {
  role: string;
  isAdmin: boolean;
  isEvaluator: boolean;
  isDeveloper: boolean;
};

export type ProjectPermissions = {
  canUploadBpmn: boolean;
  canUploadCode: boolean;
  canRunAnalysis: boolean;
  canUpdateThreshold: boolean;
  canManageMembers: boolean;
  canViewUploadLogs: boolean;
  canViewReport: boolean;
};

export type ProjectDetailState = {
  state: LoadState;
  errorText: string;
  data: ProjectDetailApi | null;

  bpmnFile: File | null;
  codeZip: File | null;
  thresholdInput: string;
  actionMsg: string;

  showDeleteModal: boolean;
  deletingProject: boolean;

  tasks: TaskRow[];
  files: FileRow[];
  matches: MatchRow[];
  resultsError: string;
  resultsLoading: boolean;

  compareLoading: boolean;
  compareError: string;
  bpmnCompare: CompareBpmnTask[];
  codeCompare: CompareCodeFn[];

  reportState: LoadState;
  reportError: string;
  report: ReportPayload;

  recState: LoadState;
  recError: string;
  recommendations: string[];
  recUpdatedAt: string | null;
  hasSummary: boolean;
};