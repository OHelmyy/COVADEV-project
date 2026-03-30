import { useCallback, useState } from "react";
import { fetchCompareInputs } from "../../../api/projects";
import type { CompareBpmnTask, CompareCodeFn } from "../types/projectDetail";

export function useProjectDetailCompare(projectId: number) {
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [bpmnCompare, setBpmnCompare] = useState<CompareBpmnTask[]>([]);
  const [codeCompare, setCodeCompare] = useState<CompareCodeFn[]>([]);

  const loadCompare = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;

    setCompareLoading(true);
    setCompareError("");

    try {
      const response = await fetchCompareInputs(projectId);
      setBpmnCompare((response?.bpmnTasks ?? []) as CompareBpmnTask[]);
      setCodeCompare((response?.codeFunctions ?? []) as CompareCodeFn[]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load compare inputs";
      setCompareError(message);
    } finally {
      setCompareLoading(false);
    }
  }, [projectId]);

  return {
    compareLoading,
    compareError,
    bpmnCompare,
    codeCompare,
    loadCompare,
  };
}