import { useCallback, useState } from "react";
import {
  fetchRecommendations,
  generateRecommendations,
} from "../../../api/projects";
import type { LoadState } from "../types/projectDetail";

export function useProjectDetailRecommendations(projectId: number) {
  const [recState, setRecState] = useState<LoadState>("idle");
  const [recError, setRecError] = useState("");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [recUpdatedAt, setRecUpdatedAt] = useState<string | null>(null);
  const [hasSummary, setHasSummary] = useState(true);

  const loadRecommendations = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;

    setRecState("loading");
    setRecError("");

    try {
      const response = await fetchRecommendations(projectId);
      setHasSummary(Boolean(response?.hasSummary));
      setRecommendations(response?.recommendations ?? []);
      setRecUpdatedAt(response?.updatedAt ?? null);
      setRecState("success");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load recommendations";
      setRecError(message);
      setRecState("error");
    }
  }, [projectId]);

  const generate = useCallback(async () => {
    await generateRecommendations(projectId);
  }, [projectId]);

  return {
    recState,
    recError,
    recommendations,
    recUpdatedAt,
    hasSummary,
    loadRecommendations,
    generate,
  };
}