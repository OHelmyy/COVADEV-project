import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ConfirmModal from "../../../components/ConfirmModal";
import ErrorModal from "../../../components/ErrorModal";
import StatusMessage from "../../../components/StatusMessage";
import TaskManagementTab from "../../task-management/components/TaskManagementTab";

import ProjectDetailLayout from "../components/project-detail/ProjectDetailLayout";
import ProjectSidebar from "../components/project-detail/ProjectSidebar";
import AiRunsTab from "../../task-management/components/AiRunsTab";
import OverviewTab from "../components/project-detail/tabs/OverviewTab";
import BpmnCheckTab from "../components/project-detail/tabs/BpmnCheckTab";
import BpmnDiagramTab from "../components/project-detail/tabs/BpmnDiagramTab";
import UploadsTab from "../components/project-detail/tabs/UploadsTab";
import ResultsTab from "../components/project-detail/tabs/ResultsTab";
import CompareTab from "../components/project-detail/tabs/CompareTab";
import RecommendationsTab from "../components/project-detail/tabs/RecommendationsTab";
import ReportTab from "../components/project-detail/tabs/ReportTab";
import RunsTab from "../components/project-detail/tabs/RunsTab";
import MembersTab from "../components/project-detail/tabs/MembersTab";
import MyTasksTab from "../components/project-detail/tabs/MyTasksTab";
import DevSubmissionsTab from "../components/project-detail/tabs/DevSubmissionsTab";
import GitHubTab from "../components/project-detail/tabs/GitHubTab";
import { useProjectDetail } from "../hooks/useProjectDetail";
import { normalizeBpmnMeta } from "../utils/projectDetail";
import { buildProjectErrorFromText } from "../utils/projectError";
import { Card, SubTabs } from "../components/project-detail/ProjectUi";
import { ui } from "../../../theme/ui";

export default function ProjectDetailPage() {
  const { projectId: projectIdParam } = useParams();
  const projectId = Number(projectIdParam);

  const vm = useProjectDetail(projectId);

  const [subTabState, setSubTabState] = useState<Record<string, string>>({
    overview: "overview",
    data: "uploads",
    tasks: "taskManagement",
    analysis: "results",
    report: "report",
  });

  const activeSubTab = subTabState[vm.activeTab] || "";

  const handleSubTabChange = (key: string) => {
    setSubTabState(prev => ({ ...prev, [vm.activeTab]: key }));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (vm.compareError) {
      const info = buildProjectErrorFromText(
        "load compare inputs",
        vm.compareError,
        "Compare load failed"
      );
      vm.openErrorModal("load compare inputs", new Error(info.details), info.title);
    }
  }, [vm.compareError]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (vm.resultsError) {
      const info = buildProjectErrorFromText(
        "load analysis results",
        vm.resultsError,
        "Results load failed"
      );
      vm.openErrorModal("load analysis results", new Error(info.details), info.title);
    }
  }, [vm.resultsError]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (vm.reportError) {
      const info = buildProjectErrorFromText(
        "load report",
        vm.reportError,
        "Report load failed"
      );
      vm.openErrorModal("load report", new Error(info.details), info.title);
    }
  }, [vm.reportError]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (vm.recError) {
      const info = buildProjectErrorFromText(
        "load recommendations",
        vm.recError,
        "Recommendations load failed"
      );
      vm.openErrorModal("load recommendations", new Error(info.details), info.title);
    }
  }, [vm.recError]);

  if (vm.state === "loading" || vm.state === "idle") {
    return <StatusMessage title="Loading project..." />;
  }

  if (vm.state === "error") {
    return (
      <StatusMessage
        title="Failed to load project"
        message={vm.errorText}
        onRetry={vm.load}
      />
    );
  }

  if (!vm.data) return null;

  const { isWellFormed, precheckWarnings, precheckErrors, bpmnSummary } =
    normalizeBpmnMeta(vm.data);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top right, rgba(6,182,212,0.07), transparent 22%), radial-gradient(circle at top left, rgba(109,40,217,0.05), transparent 18%), #f4f7fb",
        padding: "20px 0 36px",
      }}
    >
      <ProjectDetailLayout
        sidebar={
          <ProjectSidebar
            projectName={vm.data.project.name}
            role={vm.data.membership.role}
            isAdmin={vm.roleFlags.isAdmin}
            tabs={vm.tabs}
            activeTab={vm.activeTab}
            onChangeTab={vm.setActiveTab}
          />
        }
      >
        {vm.actionMsg ? (
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              border: `1px solid ${ui.colors.border}`,
              background: "#fff",
              color: ui.colors.text,
              boxShadow: ui.shadow.sm,
              fontWeight: 600,
            }}
          >
            {vm.actionMsg}
          </div>
        ) : null}

        {vm.activeTab === "overview" ? (
          <>
            <SubTabs
              tabs={[
                { key: "overview", label: "Overview" },
                { key: "members", label: "Members" },
              ]}
              active={activeSubTab}
              onChange={handleSubTabChange}
            />
            {activeSubTab === "overview" && (
              <OverviewTab
                projectName={vm.data.project.name}
                description={vm.data.project.description}
                role={vm.data.membership.role}
                isAdmin={vm.roleFlags.isAdmin}
                activeBpmnName={vm.data.activeUploads.activeBpmn?.originalName}
                activeCodeName={vm.data.activeUploads.activeCode?.originalName}
                codeFilesCount={vm.data.counts.codeFiles}
                tasksCount={vm.data.counts.tasks}
                indexedFiles={vm.data.project.indexed_files ?? []}
                matchesCount={vm.data.counts.matches}
                onDeleteProject={vm.onDeleteProject}
                onUpdateGithubUrl={vm.onUpdateGithubUrl}
                githubRepoUrl={vm.data.project.github_repo_url}
              />
            )}
            {activeSubTab === "members" && (
              <MembersTab
                projectId={vm.data.project.id}
                initialMembers={vm.data.members}
                currentUserRole={vm.data.membership?.role}
              />
            )}
          </>
        ) : null}

        {vm.activeTab === "data" ? (
          <>
            <SubTabs
              tabs={[
                { key: "uploads", label: "Uploads & Tools" },
                { key: "bpmnCheck", label: "BPMN Check" },
                { key: "bpmnDiagram", label: "BPMN Diagram" },
                { key: "recommendations", label: "Recommendations" },
              ]}
              active={activeSubTab}
              onChange={handleSubTabChange}
            />
            {activeSubTab === "uploads" && (
              <UploadsTab
                canUploadBpmn={vm.permissions.canUploadBpmn}
                canUploadCode={vm.permissions.canUploadCode}
                canRunAnalysis={vm.permissions.canRunAnalysis}
                bpmnFile={vm.bpmnFile}
                codeZip={vm.codeZip}
                setBpmnFile={vm.setBpmnFile}
                setCodeZip={vm.setCodeZip}
                onUploadBpmn={vm.onUploadBpmn}
                onUploadCode={vm.onUploadCode}
                onRunAnalysis={vm.onRunAnalysis}
                onFetchGithubCode={vm.onFetchGithubCode}
                githubRepoUrl={vm.data.project.github_repo_url}
                projectId={projectId}
              />
            )}
            {activeSubTab === "bpmnCheck" && (
              <BpmnCheckTab
                activeBpmn={vm.data.activeUploads.activeBpmn}
                isWellFormed={isWellFormed}
                precheckWarnings={precheckWarnings}
                precheckErrors={precheckErrors}
                bpmnSummary={bpmnSummary}
              />
            )}
            {activeSubTab === "bpmnDiagram" && (
              <BpmnDiagramTab
                projectId={projectId}
                canEdit={vm.roleFlags.isEvaluator || vm.roleFlags.isAdmin}
              />
            )}
            {activeSubTab === "recommendations" && (
              <RecommendationsTab
                recState={vm.recState}
                recError={vm.recError}
                recommendations={vm.recommendations}
                recUpdatedAt={vm.recUpdatedAt}
                hasSummary={vm.hasSummary}
                canGenerate={vm.roleFlags.isEvaluator || vm.roleFlags.isAdmin}
                onRefresh={vm.loadRecommendations}
                onGenerate={vm.onGenerateRecommendations}
                onRetry={vm.loadRecommendations}
              />
            )}
          </>
        ) : null}

        {vm.activeTab === "tasks" ? (
          <>
            <SubTabs
              tabs={[
                { key: "taskManagement", label: "Task Management" },
                { key: "devSubmissions", label: "Dev Submissions" },
                { key: "aiRuns", label: "AI Runs" },
                { key: "github", label: "GitHub" },
              ]}
              active={activeSubTab}
              onChange={handleSubTabChange}
            />
            {activeSubTab === "taskManagement" && (
              <Card>
                <TaskManagementTab projectId={projectId} isAdmin={vm.roleFlags.isAdmin} />
              </Card>
            )}
            {activeSubTab === "devSubmissions" && <DevSubmissionsTab projectId={projectId} />}
            {activeSubTab === "aiRuns" && (
              <Card>
                <AiRunsTab projectId={projectId} />
              </Card>
            )}
            {activeSubTab === "github" && <GitHubTab projectId={projectId} isAdmin={vm.roleFlags.isAdmin} />}
          </>
        ) : null}

        {vm.activeTab === "analysis" ? (
          <>
            <SubTabs
              tabs={[
                { key: "results", label: "Results" },
                { key: "compare", label: "Compare" },
              ]}
              active={activeSubTab}
              onChange={handleSubTabChange}
            />
            {activeSubTab === "results" && (
              <ResultsTab
                resultsLoading={vm.resultsLoading}
                resultsError={vm.resultsError}
                tasksCount={vm.tasks.length}
                matched={vm.matched}
                missing={vm.missing}
                extra={vm.extra}
                coverage={vm.coverage}
                scoreAvg={vm.scoreAvg}
                files={vm.files}
                onRefresh={vm.loadResults}
              />
            )}
            {activeSubTab === "compare" && (
              <CompareTab
                compareLoading={vm.compareLoading}
                compareError={vm.compareError}
                bpmnCompare={vm.bpmnCompare}
                codeCompare={vm.codeCompare}
                onRefresh={vm.loadCompare}
              />
            )}
          </>
        ) : null}

        {vm.activeTab === "report" ? (
          <>
            <SubTabs
              tabs={[
                { key: "report", label: "Report Document" },
                { key: "runs", label: "Analysis Runs History" },
              ]}
              active={activeSubTab}
              onChange={handleSubTabChange}
            />
            {activeSubTab === "report" && (
              <ReportTab
                canViewReport={vm.permissions.canViewReport}
                reportState={vm.reportState}
                reportError={vm.reportError}
                report={vm.report}
                onRefresh={vm.loadReport}
                onRetry={vm.loadReport}
                onDownloadPdf={() => vm.downloadReport("pdf")}
              />
            )}
            {activeSubTab === "runs" && <RunsTab runs={vm.data.runs} />}
          </>
        ) : null}

        {vm.activeTab === "myTasks" ? (
          <MyTasksTab projectId={projectId} />
        ) : null}

        {vm.activeTab === "devOverview" ? (
          <DevOverviewTab
            projectName={vm.data.project.name}
            description={vm.data.project.description}
            bpmnSummary={bpmnSummary}
            projectId={projectId}
          />
        ) : null}

        {vm.activeTab === "devBpmn" ? (
          <DevBpmnTab projectId={projectId} />
        ) : null}

        {vm.activeTab === "devRecommendations" ? (
          <RecommendationsTab
            recState={vm.recState}
            recError={vm.recError}
            recommendations={vm.recommendations}
            recUpdatedAt={vm.recUpdatedAt}
            hasSummary={vm.hasSummary}
            canGenerate={false}
            onRefresh={vm.loadRecommendations}
            onGenerate={async () => { }}
            onRetry={vm.loadRecommendations}
          />
        ) : null}

        {vm.activeTab === "devHistory" ? (
          <DevHistoryTab projectId={projectId} />
        ) : null}

      </ProjectDetailLayout>

      <ConfirmModal
        open={vm.showDeleteModal}
        title="Delete project?"
        message={`Delete "${vm.data.project.name}" permanently? This action cannot be undone.`}
        confirmText={vm.deletingProject ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        danger
        onCancel={() => {
          if (vm.deletingProject) return;
          vm.setShowDeleteModal(false);
        }}
        onConfirm={vm.confirmDeleteProject}
      />
      <ErrorModal
        open={vm.errorModal.open}
        title={vm.errorModal.title}
        message={vm.errorModal.message}
        cause={vm.errorModal.cause}
        details={vm.errorModal.details}
        onClose={vm.closeErrorModal}
      />
    </div>
  );
}

// ── Developer: Overview Tab ───────────────────────────────────────────────────

function DevOverviewTab({
  projectName, description, bpmnSummary, projectId,
}: {
  projectName: string;
  description?: string;
  bpmnSummary?: string;
  projectId: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800 }}>{projectName}</h2>
        {description && (
          <p style={{ margin: "0 0 20px", color: "#555", fontSize: 14, lineHeight: 1.6 }}>{description}</p>
        )}
        {bpmnSummary && (
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Process Summary
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{bpmnSummary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Developer: BPMN Diagram + Assigned Task Descriptions ─────────────────────

function DevBpmnTab({ projectId }: { projectId: number }) {
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  useEffect(() => {
    import("../../../api/projects").then(({ fetchMyTasks }) => {
      fetchMyTasks(projectId)
        .then(res => setMyTasks(res.tasks || []))
        .catch(() => { })
        .finally(() => setLoadingTasks(false));
    });
  }, [projectId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BpmnDiagramTab projectId={projectId} canEdit={false} />

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Your Assigned Tasks</h3>
        {loadingTasks ? (
          <div style={{ color: "#888", fontSize: 13 }}>Loading tasks…</div>
        ) : myTasks.length === 0 ? (
          <div style={{ color: "#888", fontSize: 13 }}>No tasks assigned to you yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {myTasks.map((t: any) => (
              <div key={t.taskId} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 18px", background: "#f8fafc" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 6 }}>{t.taskName}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", marginBottom: 8 }}>ID: {t.taskId}</div>
                {t.taskDescription && (
                  <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{t.taskDescription}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Developer: Submission History Tab ────────────────────────────────────────

function DevHistoryTab({ projectId }: { projectId: number }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("../../../api/projects").then(({ fetchMyTasks }) => {
      fetchMyTasks(projectId)
        .then(res => setTasks(res.tasks || []))
        .catch(() => { })
        .finally(() => setLoading(false));
    });
  }, [projectId]);

  const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
    PENDING: { bg: "#fff8e1", fg: "#8a5a00", border: "#ffe58f" },
    ACCEPTED: { bg: "#f0fdf4", fg: "#16a34a", border: "#bbf7d0" },
    REJECTED: { bg: "#fef2f2", fg: "#dc2626", border: "#fecaca" },
    REASSIGNED: { bg: "#f5f3ff", fg: "#7c3aed", border: "#ddd6fe" },
  };

  if (loading) return <div style={{ padding: 24, color: "#888" }}>Loading history…</div>;
  if (tasks.length === 0) return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "40px 0", textAlign: "center", color: "#888" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
      <div style={{ fontWeight: 600 }}>No submissions yet</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>Submit your work via GitHub PR or ZIP from the My Tasks tab.</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {tasks.map((t: any) => {
        const sub = t.submission;
        const colors = sub ? (STATUS_COLORS[sub.status] ?? STATUS_COLORS.PENDING) : null;
        return (
          <div key={t.taskId} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${colors?.border ?? "#e5e7eb"}`, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{t.taskName}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginTop: 3 }}>{t.taskId}</div>
              </div>
              {sub && colors && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {sub.similarityScore != null && (
                    <span style={{
                      background: sub.similarityScore >= 0.75 ? "#f0fdf4" : sub.similarityScore >= 0.5 ? "#fff8e1" : "#fef2f2",
                      color: sub.similarityScore >= 0.75 ? "#16a34a" : sub.similarityScore >= 0.5 ? "#8a5a00" : "#dc2626",
                      fontWeight: 700, fontSize: 11, padding: "2px 10px", borderRadius: 12,
                    }}>
                      {Math.round(sub.similarityScore * 100)}% match
                    </span>
                  )}
                  <span style={{ background: colors.bg, color: colors.fg, fontWeight: 700, fontSize: 11, padding: "3px 10px", borderRadius: 12, border: `1px solid ${colors.border}` }}>
                    {sub.status}
                  </span>
                </div>
              )}
            </div>

            {sub ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  Attempt #{sub.attemptNumber} · Submitted {new Date(sub.submittedAt).toLocaleString()}
                </div>
                {sub.feedback && (
                  <div style={{ marginTop: 10, background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                    <strong style={{ color: "#8a5a00" }}>Evaluator feedback: </strong>
                    <span style={{ color: "#78350f" }}>{sub.feedback}</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: 13, color: "#94a3b8" }}>No submission yet.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
