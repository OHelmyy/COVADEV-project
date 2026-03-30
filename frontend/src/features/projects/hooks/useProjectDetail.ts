import { useEffect, useState } from "react";
import type { TabKey } from "../types/projectDetail";
import { useProjectDetailActions } from "./useProjectDetailActions";
import { useProjectDetailCompare } from "./useProjectDetailCompare";
import { useProjectDetailData } from "./useProjectDetailData";
import { useProjectDetailRecommendations } from "./useProjectDetailRecommendations";
import { useProjectDetailReport } from "./useProjectDetailReport";
import { useProjectDetailResults } from "./useProjectDetailResults";

export function useProjectDetail(projectId: number) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const project = useProjectDetailData(projectId);
  const results = useProjectDetailResults(projectId);
  const compare = useProjectDetailCompare(projectId);
  const report = useProjectDetailReport(projectId);
  const recommendations = useProjectDetailRecommendations(projectId);

  const actions = useProjectDetailActions({
    projectId,
    thresholdInput: project.thresholdInput,
    reloadProject: project.load,
    reloadResults: results.loadResults,
    reloadCompare: compare.loadCompare,
    reloadRecommendations: recommendations.loadRecommendations,
  });

  useEffect(() => {
    if (!Number.isFinite(projectId)) return;

    void project.load();
    void results.loadResults();
  }, [projectId, project.load, results.loadResults]);

  useEffect(() => {
    const keys = new Set(project.tabs.map((tab) => tab.key));
    if (!keys.has(activeTab)) {
      setActiveTab(project.tabs[0]?.key ?? "overview");
    }
  }, [project.tabs, activeTab]);

  useEffect(() => {
    if (activeTab === "compare") {
      void compare.loadCompare();
    }
  }, [activeTab, compare.loadCompare]);

  useEffect(() => {
    if (activeTab === "report" && project.permissions.canViewReport) {
      void report.loadReport();
    }
  }, [activeTab, project.permissions.canViewReport, report.loadReport]);

  useEffect(() => {
    if (activeTab === "recommendations") {
      void recommendations.loadRecommendations();
    }
  }, [activeTab, recommendations.loadRecommendations]);

  return {
    activeTab,
    setActiveTab,

    ...project,
    ...results,
    ...compare,
    ...report,
    ...recommendations,
    ...actions,
  };
}