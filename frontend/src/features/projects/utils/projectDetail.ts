import type {
  CompareBpmnTask,
  CompareCodeFn,
  MatchRow,
  MissingResultRow,
  ProjectPermissions,
  ProjectRoleFlags,
  ProjectTabItem,
  TabKey,
  TaskRow,
} from "../types/projectDetail";

export function getRoleFlags(roleValue?: string | null): ProjectRoleFlags {
  const role = String(roleValue || "").toUpperCase();

  return {
    role,
    isAdmin: role === "ADMIN",
    isEvaluator: role === "EVALUATOR",
    isDeveloper: role === "DEVELOPER",
  };
}

export function getPermissions(flags: ProjectRoleFlags): ProjectPermissions {
  return {
    canUploadBpmn: flags.isEvaluator,
    canUploadCode: flags.isEvaluator || flags.isDeveloper,
    canRunAnalysis: flags.isEvaluator || flags.isDeveloper,
    canUpdateThreshold: flags.isEvaluator,
    canManageMembers: flags.isEvaluator,
    canViewUploadLogs: flags.isEvaluator,
    canViewReport: flags.isAdmin || flags.isEvaluator,
  };
}

export function getTabs(
  isAdmin: boolean,
  canViewReport: boolean
): ProjectTabItem[] {
  const all: ProjectTabItem[] = [
    { key: "overview", label: "Overview", visible: true },
    { key: "uploads", label: "Uploads & Analysis", visible: !isAdmin },
    { key: "bpmnCheck", label: "BPMN Check", visible: true },
    { key: "bpmnDiagram", label: "BPMN Diagram", visible: true },
    { key: "taskManagement", label: "Task Management", visible: true },
    { key: "results", label: "Results", visible: true },
    { key: "compare", label: "Compare", visible: true },
    { key: "recommendations", label: "Recommendations", visible: true },
    { key: "report", label: "Report", visible: canViewReport },
    { key: "runs", label: "Runs", visible: true },
    { key: "members", label: "Members", visible: true },
  ];

  return all.filter((tab) => tab.visible);
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

export function getMatched(matches: MatchRow[]): MatchRow[] {
  return matches.filter(
    (row) => row.task && !String(row.status).toLowerCase().includes("missing")
  );
}

export function getMissing(tasks: TaskRow[], matches: MatchRow[]): MissingResultRow[] {
  const matched = getMatched(matches);

  const matchedTaskIds = new Set(
    matched.map((item) => item.task?.task_id).filter(Boolean) as string[]
  );

  const explicitMissing = matches.filter((item) =>
    String(item.status).toLowerCase().includes("missing")
  );

  const implicitMissing = tasks.filter((task) => !matchedTaskIds.has(task.task_id));

  const map = new Map<string, MissingResultRow>();

  explicitMissing.forEach((item) => {
    if (!item.task) return;

    map.set(item.task.task_id, {
      task_id: item.task.task_id,
      name: item.task.name,
      reason: "Marked missing",
    });
  });

  implicitMissing.forEach((task) => {
    if (map.has(task.task_id)) return;

    map.set(task.task_id, {
      task_id: task.task_id,
      name: task.name,
      reason: "No match found",
    });
  });

  return Array.from(map.values());
}

export function getExtra(matches: MatchRow[]): MatchRow[] {
  return matches.filter(
    (row) => !row.task || String(row.status).toLowerCase().includes("extra")
  );
}

export function getScoreAvg(matches: MatchRow[]): number {
  const matched = getMatched(matches);
  if (matched.length === 0) return 0;

  const total = matched.reduce(
    (sum, item) => sum + (Number(item.similarity_score) || 0),
    0
  );

  return total / matched.length;
}

export function getCoverage(tasks: TaskRow[], matches: MatchRow[]): number {
  if (tasks.length === 0) return 0;

  const matched = getMatched(matches);
  const matchedTaskIds = new Set(
    matched.map((item) => item.task?.task_id).filter(Boolean) as string[]
  );

  return (matchedTaskIds.size / tasks.length) * 100;
}

export function formatPercent(value: number): string {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

export function getBadgeColors(value: number) {
  const pct = (Number(value) || 0) * 100;

  if (pct >= 80) {
    return { bg: "#eef5ff", fg: "#094780" };
  }

  if (pct >= 70) {
    return { bg: "#fff5e6", fg: "#8a5a00" };
  }

  return { bg: "#ffecec", fg: "#a00000" };
}

export function getBpmnCompareBody(task: CompareBpmnTask): string {
  return (
    (task.summaryText && task.summaryText.trim()) ||
    (task.compareText && String(task.compareText).trim()) ||
    "No generated summary available."
  );
}

export function getCodeComparePresentation(code: CompareCodeFn) {
  const title =
    (code.functionName && String(code.functionName).trim()) ||
    (code.symbol && String(code.symbol).trim()) ||
    "Unnamed Function";

  const filePath =
    (code.filePath && String(code.filePath).trim()) ||
    (code.file && String(code.file).trim()) ||
    "";

  const subtitle = filePath ? `${code.codeUid} — ${filePath}` : `${code.codeUid}`;

  const body =
    (code.summaryText && String(code.summaryText).trim()) ||
    (code.summary_text && String(code.summary_text).trim()) ||
    (code.summary && String(code.summary).trim()) ||
    "No generated summary available.";

  return { title, subtitle, body };
}

export function normalizeBpmnMeta(data: any) {
  const bpmnMeta = data?.activeUploads?.activeBpmn ?? null;

  const isWellFormed =
    typeof bpmnMeta?.isWellFormed === "boolean"
      ? bpmnMeta.isWellFormed
      : typeof bpmnMeta?.is_well_formed === "boolean"
      ? bpmnMeta.is_well_formed
      : null;

  const precheckWarnings: string[] = Array.isArray(bpmnMeta?.precheckWarnings)
    ? bpmnMeta.precheckWarnings
    : Array.isArray(bpmnMeta?.precheck_warnings)
    ? bpmnMeta.precheck_warnings
    : [];

  const precheckErrors: string[] = Array.isArray(bpmnMeta?.precheckErrors)
    ? bpmnMeta.precheckErrors
    : Array.isArray(bpmnMeta?.precheck_errors)
    ? bpmnMeta.precheck_errors
    : [];

  const bpmnSummary =
    typeof bpmnMeta?.bpmnSummary === "string"
      ? bpmnMeta.bpmnSummary
      : typeof bpmnMeta?.bpmn_summary === "string"
      ? bpmnMeta.bpmn_summary
      : "";

  return {
    bpmnMeta,
    isWellFormed,
    precheckWarnings,
    precheckErrors,
    bpmnSummary,
  };
}

export const th: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #eee",
};

export const td: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #f3f3f3",
};

export const codeboxStyle: React.CSSProperties = {
  marginTop: 8,
  maxHeight: 160,
  overflow: "auto",
  whiteSpace: "pre-wrap",
  background: "#0b0f1a",
  color: "#e5e7eb",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #111827",
};