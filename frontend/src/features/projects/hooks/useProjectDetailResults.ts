import { useCallback, useMemo, useState } from "react";
import { fetchFiles, fetchMatches, fetchTasks } from "../../../api/projects";
import type { FileRow, MatchRow, TaskRow } from "../types/projectDetail";
import {
  getCoverage,
  getExtra,
  getMatched,
  getMissing,
  getScoreAvg,
} from "../utils/projectDetail";

export function useProjectDetailResults(projectId: number) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [resultsError, setResultsError] = useState("");
  const [resultsLoading, setResultsLoading] = useState(false);

  const loadResults = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;

    setResultsLoading(true);
    setResultsError("");

    try {
      const [taskRes, fileRes, matchRes] = await Promise.all([
        fetchTasks(projectId),
        fetchFiles(projectId),
        fetchMatches(projectId),
      ]);

      setTasks((taskRes?.tasks ?? []) as TaskRow[]);
      setFiles((fileRes?.files ?? []) as FileRow[]);
      setMatches((matchRes?.matches ?? []) as MatchRow[]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load analysis results";
      setResultsError(message);
    } finally {
      setResultsLoading(false);
    }
  }, [projectId]);

  const matched = useMemo(() => getMatched(matches), [matches]);
  const missing = useMemo(() => getMissing(tasks, matches), [tasks, matches]);
  const extra = useMemo(() => getExtra(matches), [matches]);
  const scoreAvg = useMemo(() => getScoreAvg(matches), [matches]);
  const coverage = useMemo(() => getCoverage(tasks, matches), [tasks, matches]);

  return {
    tasks,
    files,
    matches,
    resultsError,
    resultsLoading,
    loadResults,
    matched,
    missing,
    extra,
    scoreAvg,
    coverage,
  };
}