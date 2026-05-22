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
import SummariesTab from "../components/project-detail/tabs/SummariesTab";
import RecommendationsTab from "../components/project-detail/tabs/RecommendationsTab";
import ReportTab from "../components/project-detail/tabs/ReportTab";
import RunsTab from "../components/project-detail/tabs/RunsTab";
import MembersTab from "../components/project-detail/tabs/MembersTab";
import MyTasksTab from "../components/project-detail/tabs/MyTasksTab";
import HelpTab from "../components/project-detail/tabs/HelpTab";
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
                { key: "summaries", label: "summaries" },
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

                canRunAnalysis={vm.permissions.canRunAnalysis}
                onRunAnalysis={vm.onRunAnalysis}
              />
            )}
            {activeSubTab === "summaries" && (
              <SummariesTab
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
          <MyTasksTab projectId={projectId} githubRepoUrl={vm.data.project.github_repo_url} />
        ) : null}

        {vm.activeTab === "devBpmn" ? (
          <DevBpmnTab projectId={projectId} bpmnSummary={bpmnSummary} />
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

        {vm.activeTab === "devHelp" ? (
          <HelpTab role="developer" />
        ) : null}

        {vm.activeTab === "evalHelp" ? (
          <HelpTab role="evaluator" />
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
// ── Developer: BPMN Diagram + Assigned Task Descriptions ─────────────────────

function DevBpmnTab({ projectId, bpmnSummary }: { projectId: number; bpmnSummary?: string }) {
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeSubTab, setActiveSubTab] = useState<"summary" | "tasks">("summary");

  useEffect(() => {
    import("../../../api/projects").then(({ fetchMyTasks }) => {
      fetchMyTasks(projectId)
        .then(res => setMyTasks(res.tasks || []))
        .catch(() => { })
        .finally(() => setLoadingTasks(false));
    });
  }, [projectId]);

  const TASK_COLORS = [
    { accent: "#6366f1", soft: "#eef2ff", border: "#c7d2fe" },
    { accent: "#0ea5e9", soft: "#f0f9ff", border: "#bae6fd" },
    { accent: "#10b981", soft: "#ecfdf5", border: "#a7f3d0" },
    { accent: "#f59e0b", soft: "#fffbeb", border: "#fde68a" },
    { accent: "#ef4444", soft: "#fef2f2", border: "#fecaca" },
    { accent: "#8b5cf6", soft: "#f5f3ff", border: "#ddd6fe" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Sub-tabs */}
      <SubTabs
        tabs={[
          { key: "summary", label: "Process Summary & Diagram" },
          { key: "tasks",   label: "Your Assigned Tasks" },
        ]}
        active={activeSubTab}
        onChange={(k) => setActiveSubTab(k as "summary" | "tasks")}
      />

      {/* ── Process Summary & Diagram tab ── */}
      {activeSubTab === "summary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {bpmnSummary ? (
            <div style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${ui.colors.border}`,
              padding: "20px 24px",
              boxShadow: ui.shadow.sm,
            }}>
              <h3 style={{
                margin: "0 0 12px",
                fontSize: 13,
                fontWeight: 900,
                color: ui.colors.primary,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}>
                Process Summary
              </h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: ui.colors.text, whiteSpace: "pre-wrap" }}>
                {bpmnSummary}
              </p>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 14, border: `1px dashed ${ui.colors.borderStrong}`, padding: "28px 24px", color: ui.colors.textMuted, fontSize: 13, textAlign: "center" }}>
              No process summary available yet.
            </div>
          )}
          <BpmnDiagramTab projectId={projectId} canEdit={false} />
        </div>
      )}

      {/* ── Your Assigned Tasks tab ── */}
      {activeSubTab === "tasks" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: ui.colors.primary, display: "inline-block", flexShrink: 0 }} />
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: ui.colors.text }}>Your Assigned Tasks</h3>
            {!loadingTasks && myTasks.length > 0 && (
              <span style={{ background: ui.colors.primary, color: "#fff", fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 999 }}>
                {myTasks.length}
              </span>
            )}
          </div>

          {loadingTasks ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2].map(k => (
                <div key={k} style={{ height: 80, borderRadius: 12, background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s infinite" }} />
              ))}
              <style>{`@keyframes skeleton-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
            </div>
          ) : myTasks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", background: "#fff", borderRadius: 14, border: `1px dashed ${ui.colors.borderStrong}` }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: ui.colors.primarySoft, border: `2px solid ${ui.colors.border}`, margin: "0 auto 10px" }} />
              <div style={{ fontWeight: 700, color: ui.colors.textSoft }}>No tasks assigned yet</div>
              <div style={{ fontSize: 13, color: ui.colors.textMuted, marginTop: 4 }}>Your project manager will assign tasks to you soon.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
              {myTasks.map((t: any, idx: number) => {
                const c = TASK_COLORS[idx % TASK_COLORS.length];
                const isOpen = !!expanded[t.taskId];
                return (
                  <div
                    key={t.taskId}
                    style={{
                      background: "#fff",
                      borderRadius: 14,
                      border: `1px solid ${ui.colors.border}`,
                      boxShadow: ui.shadow.sm,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "16px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 15, color: ui.colors.text, lineHeight: 1.4 }}>{t.taskName}</div>
                          <code style={{ fontSize: 11, color: c.accent, background: c.soft, padding: "2px 7px", borderRadius: 5, marginTop: 5, display: "inline-block", fontWeight: 700 }}>
                            {t.taskId}
                          </code>
                        </div>
                        {t.taskDescription && (
                          <button
                            onClick={() => setExpanded(p => ({ ...p, [t.taskId]: !p[t.taskId] }))}
                            style={{
                              background: isOpen ? c.soft : ui.colors.bgSoft,
                              border: `1px solid ${isOpen ? c.border : ui.colors.border}`,
                              borderRadius: 8,
                              padding: "5px 10px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 700,
                              color: isOpen ? c.accent : ui.colors.textSoft,
                              flexShrink: 0,
                            }}
                          >
                            {isOpen ? "▲ Less" : "▼ Details"}
                          </button>
                        )}
                      </div>
                      {isOpen && t.taskDescription && (
                        <div style={{ marginTop: 14, padding: "12px 14px", background: c.soft, borderRadius: 10, border: `1px solid ${c.border}` }}>
                          <p style={{ margin: 0, fontSize: 13, color: ui.colors.text, lineHeight: 1.7 }}>{t.taskDescription}</p>
                        </div>
                      )}
                      {t.assignmentStatus && (
                        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
                            background: c.soft, color: c.accent, border: `1px solid ${c.border}`,
                          }}>
                            {t.assignmentStatus.replace(/_/g, " ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Developer: Submission History Tab ────────────────────────────────────────

function ScoreBar({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  const color = pct >= 70 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
  const bg = pct >= 70 ? "#dcfce7" : pct >= 50 ? "#fef3c7" : "#fee2e2";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>{score} / {max}</span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: color, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function DevHistoryTab({ projectId }: { projectId: number }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Record<number, any>>({});

  useEffect(() => {
    import("../../../api/projects").then(({ fetchMyTasks }) => {
      fetchMyTasks(projectId)
        .then(res => setTasks(res.tasks || []))
        .catch(() => { })
        .finally(() => setLoading(false));
    });
    import("../../task-management/api/taskManagementApi").then(({ getMyPerformanceInsights }) => {
      getMyPerformanceInsights()
        .then(res => {
          const map: Record<number, any> = {};
          (res.recentAssignments || [])
            .filter((a: any) => a.projectId === projectId && a.evaluation)
            .forEach((a: any) => { map[a.assignmentId] = a.evaluation; });
          setInsights(map);
        })
        .catch(() => { });
    });
  }, [projectId]);

  const SUB_META: Record<string, { dot: string; label: string; bg: string; fg: string; border: string }> = {
    ACCEPTED:   { dot: "#16a34a", label: "Accepted",    bg: "#f0fdf4", fg: "#166534", border: "#86efac" },
    REJECTED:   { dot: "#dc2626", label: "Rejected",    bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    PENDING:    { dot: "#d97706", label: "Under Review", bg: "#fef3c7", fg: "#92400e", border: "#fde68a" },
    REASSIGNED: { dot: "#7c3aed", label: "Reassigned",  bg: "#f5f3ff", fg: "#5b21b6", border: "#ddd6fe" },
  };

  function relTime(iso?: string | null) {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const accepted   = tasks.filter(t => t.submission?.status === "ACCEPTED").length;
  const rejected   = tasks.filter(t => t.submission?.status === "REJECTED").length;
  const pending    = tasks.filter(t => t.submission?.status === "PENDING").length;
  const noSub      = tasks.filter(t => !t.submission).length;
  const scores     = Object.values(insights).map((e: any) => e.finalScore).filter(Boolean);
  const avgScore   = scores.length ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : null;

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {[1, 2, 3].map(k => (
        <div key={k} style={{ display: "flex", gap: 16, padding: "16px 0" }}>
          <div style={{ width: 14, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#e2e8f0" }} />
            <div style={{ width: 2, flex: 1, background: "#f1f5f9", marginTop: 6 }} />
          </div>
          <div style={{ flex: 1, background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #e5e7eb" }}>
            <div style={{ height: 14, width: 180, background: "#f1f5f9", borderRadius: 6, marginBottom: 8 }} />
            <div style={{ height: 11, width: 100, background: "#f1f5f9", borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );

  if (tasks.length === 0) return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "52px 0", textAlign: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: ui.colors.primarySoft, border: `2px solid ${ui.colors.border}`, margin: "0 auto 12px" }} />
      <div style={{ fontWeight: 800, fontSize: 16, color: "#334155", marginBottom: 6 }}>No submissions yet</div>
      <div style={{ fontSize: 13, color: "#94a3b8" }}>Submit your work via GitHub PR or ZIP from the My Tasks tab.</div>
    </div>
  );

  return (
    <div>
      {/* ── Stats header ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        {[
          { label: "Accepted",    value: accepted,          bg: "#f0fdf4", fg: "#16a34a", dot: "#16a34a" },
          { label: "Under Review",value: pending,           bg: "#fef3c7", fg: "#92400e", dot: "#d97706" },
          { label: "Rejected",    value: rejected,          bg: "#fef2f2", fg: "#991b1b", dot: "#dc2626" },
          { label: "Not Started", value: noSub,             bg: "#f8fafc", fg: "#64748b", dot: "#cbd5e1" },
          ...(avgScore ? [{ label: "Avg Score", value: `${avgScore}/10`, bg: "#eff6ff", fg: "#1d4ed8", dot: "#3b82f6" }] : []),
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, background: s.bg, border: `1px solid ${s.bg}`, borderRadius: 10, padding: "8px 14px" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.dot, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontWeight: 900, fontSize: 15, color: s.fg }}>{s.value}</span>
            <span style={{ fontSize: 12, color: s.fg, opacity: 0.8 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Timeline ── */}
      <div style={{ position: "relative" }}>
        {tasks.map((t: any, idx: number) => {
          const sub = t.submission;
          const meta = sub ? (SUB_META[sub.status] ?? SUB_META.PENDING) : null;
          const evaluation = insights[t.assignmentId] ?? null;
          const isLast = idx === tasks.length - 1;

          return (
            <div key={t.taskId} style={{ display: "flex", gap: 16, paddingBottom: isLast ? 0 : 20 }}>
              {/* Timeline spine */}
              <div style={{ width: 14, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 18 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                  background: meta?.dot ?? "#cbd5e1",
                  boxShadow: meta ? `0 0 0 3px ${meta.bg}` : "none",
                }} />
                {!isLast && <div style={{ width: 2, flex: 1, background: "#e2e8f0", marginTop: 6 }} />}
              </div>

              {/* Card */}
              <div style={{
                flex: 1,
                background: "#fff",
                borderRadius: 14,
                border: `1.5px solid ${meta?.border ?? "#e5e7eb"}`,
                padding: "16px 20px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                {/* Card header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>{t.taskName}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>{t.taskId}</div>
                  </div>
                  {meta && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {sub?.similarityScore != null && (
                        <span
                          title="How closely your code matched the expected task implementation"
                          style={{
                            background: sub.similarityScore >= 0.75 ? "#f0fdf4" : sub.similarityScore >= 0.5 ? "#fef3c7" : "#fef2f2",
                            color:      sub.similarityScore >= 0.75 ? "#16a34a" : sub.similarityScore >= 0.5 ? "#92400e" : "#dc2626",
                            fontWeight: 700, fontSize: 11, padding: "3px 10px", borderRadius: 999,
                            border: "1px solid currentColor", cursor: "help",
                          }}
                        >
                          {Math.round(sub.similarityScore * 100)}% match
                        </span>
                      )}
                      <span style={{ background: meta.bg, color: meta.fg, fontWeight: 700, fontSize: 11, padding: "4px 12px", borderRadius: 999, border: `1px solid ${meta.border}` }}>
                        {meta.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Submission meta */}
                {sub ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", gap: 12 }}>
                      <span>Attempt #{sub.attemptNumber}</span>
                      <span title={new Date(sub.submittedAt).toLocaleString()} style={{ cursor: "help" }}>
                        Submitted {relTime(sub.submittedAt)}
                      </span>
                    </div>

                    {sub.feedback && (
                      <div style={{ marginTop: 10, background: "#fffbe6", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Evaluator Feedback</div>
                        <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>{sub.feedback}</div>
                      </div>
                    )}

                    {/* Evaluation score card */}
                    {evaluation && (
                      <div style={{ marginTop: 14, padding: "14px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 13, color: "#334155" }}>Evaluation Scores</span>
                          <span style={{
                            fontWeight: 900, fontSize: 15,
                            color:      evaluation.finalScore >= 7 ? "#16a34a" : evaluation.finalScore >= 5 ? "#d97706" : "#dc2626",
                            background: evaluation.finalScore >= 7 ? "#f0fdf4" : evaluation.finalScore >= 5 ? "#fef3c7" : "#fee2e2",
                            padding: "3px 12px", borderRadius: 8,
                          }}>
                            Final: {evaluation.finalScore} / 10
                          </span>
                        </div>
                        <ScoreBar label="Correctness"   score={evaluation.correctnessScore} />
                        <ScoreBar label="Quality"       score={evaluation.qualityScore} />
                        <ScoreBar label="Timeliness"    score={evaluation.timelinessScore} />
                        <ScoreBar label="Communication" score={evaluation.communicationScore} />
                        {evaluation.comments && (
                          <div style={{ marginTop: 10, fontSize: 12, color: "#475569", fontStyle: "italic" }}>
                            "{evaluation.comments}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 10, fontSize: 13, color: "#94a3b8" }}>No submission yet — go to My Tasks to submit.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
