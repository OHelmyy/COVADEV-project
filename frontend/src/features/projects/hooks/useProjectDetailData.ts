import { useCallback, useMemo, useState } from "react";
import { fetchProjectDetail } from "../../../api/projects";
import type { ProjectDetailApi } from "../../../api/types";
import type { LoadState } from "../types/projectDetail";
import { getPermissions, getRoleFlags, getTabs } from "../utils/projectDetail";

export function useProjectDetailData(projectId: number) {
  const [state, setState] = useState<LoadState>("idle");
  const [errorText, setErrorText] = useState("");
  const [data, setData] = useState<ProjectDetailApi | null>(null);
  const [thresholdInput, setThresholdInput] = useState("");

  const load = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;

    try {
      setState("loading");
      setErrorText("");

      const response = await fetchProjectDetail(projectId);
      setData(response);
      setThresholdInput(String(response.project.similarityThreshold));
      setState("success");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load project";
      setErrorText(message);
      setState("error");
    }
  }, [projectId]);

  const roleFlags = useMemo(
    () => getRoleFlags(data?.membership?.role),
    [data?.membership?.role]
  );

  const permissions = useMemo(
    () => getPermissions(roleFlags),
    [roleFlags]
  );

  const tabs = useMemo(
    () => getTabs(roleFlags.isAdmin, permissions.canViewReport,roleFlags.isDeveloper),
    [roleFlags.isAdmin, permissions.canViewReport, roleFlags.isDeveloper]
  );

  return {
    state,
    errorText,
    data,
    thresholdInput,
    setThresholdInput,
    load,
    roleFlags,
    permissions,
    tabs,
  };
}