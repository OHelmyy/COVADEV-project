import { useCallback, useState } from "react";
import { fetchProjectReport } from "../api/projectReport";
import type { LoadState, ReportPayload } from "../types/projectDetail";

export function useProjectDetailReport(projectId: number) {
  const [reportState, setReportState] = useState<LoadState>("idle");
  const [reportError, setReportError] = useState("");
  const [report, setReport] = useState<ReportPayload>({
    traceability: [],
    missingTasks: [],
    extraCode: [],
  });

  const loadReport = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;

    setReportState("loading");
    setReportError("");

    try {
      const response = await fetchProjectReport(projectId);
      setReport({
        traceability: response?.traceability ?? [],
        missingTasks: response?.missingTasks ?? [],
        extraCode: response?.extraCode ?? [],
      });
      setReportState("success");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load report";
      setReportError(message);
      setReportState("error");
    }
  }, [projectId]);

  const downloadReport = useCallback(
    async (format: "pdf" | "csv" | "html") => {
      const url = `/api/projects/${projectId}/report/export?format=${format}`;
      const response = await fetch(url, { credentials: "include" });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Export failed");
      }

      const blob = await response.blob();
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `project_${projectId}_report.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(anchor.href);
    },
    [projectId]
  );

  return {
    reportState,
    reportError,
    report,
    loadReport,
    downloadReport,
  };
}