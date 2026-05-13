import { useEffect } from "react";
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
import UploadsTab from "../components/project-detail/tabs/UploadsTab";
import ResultsTab from "../components/project-detail/tabs/ResultsTab";
import CompareTab from "../components/project-detail/tabs/CompareTab";
import RecommendationsTab from "../components/project-detail/tabs/RecommendationsTab";
import ReportTab from "../components/project-detail/tabs/ReportTab";
import RunsTab from "../components/project-detail/tabs/RunsTab";
import MembersTab from "../components/project-detail/tabs/MembersTab";
import MyTasksTab from "../components/project-detail/tabs/MyTasksTab";
import DevSubmissionsTab from "../components/project-detail/tabs/DevSubmissionsTab";
import { useProjectDetail } from "../hooks/useProjectDetail";
import { normalizeBpmnMeta } from "../utils/projectDetail";
import { buildProjectErrorFromText } from "../utils/projectError";
import { Card } from "../components/project-detail/ProjectUi";
import { ui } from "../../../theme/ui";

export default function ProjectDetailPage() {
  const { projectId: projectIdParam } = useParams();
  const projectId = Number(projectIdParam);

  const vm = useProjectDetail(projectId);

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
          <OverviewTab
            projectName={vm.data.project.name}
            description={vm.data.project.description}
            role={vm.data.membership.role}
            isAdmin={vm.roleFlags.isAdmin}
            activeBpmnName={vm.data.activeUploads.activeBpmn?.originalName}
            activeCodeName={vm.data.activeUploads.activeCode?.originalName}
            codeFilesCount={vm.data.counts.codeFiles}
            tasksCount={vm.data.counts.tasks}
            matchesCount={vm.data.counts.matches}
            onDeleteProject={vm.onDeleteProject}
          />
        ) : null}

        {vm.activeTab === "bpmnCheck" ? (
          <BpmnCheckTab
            activeBpmn={vm.data.activeUploads.activeBpmn}
            isWellFormed={isWellFormed}
            precheckWarnings={precheckWarnings}
            precheckErrors={precheckErrors}
            bpmnSummary={bpmnSummary}
          />
        ) : null}

        {vm.activeTab === "taskManagement" ? (
          <Card>
            <TaskManagementTab projectId={projectId} />
          </Card>
        ) : null}
        
        {vm.activeTab === "aiRuns" ? (
          <Card>
            <AiRunsTab projectId={projectId} />
          </Card>
        ) : null}
        {vm.activeTab === "myTasks" ? (
          <MyTasksTab projectId={projectId} />
        ) : null}

        {vm.activeTab === "devSubmissions" ? (
          <DevSubmissionsTab projectId={projectId} />
        ) : null}

        {vm.activeTab === "uploads" ? (
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
          />
        ) : null}

        {vm.activeTab === "results" ? (
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
        ) : null}

        {vm.activeTab === "compare" ? (
          <CompareTab
            compareLoading={vm.compareLoading}
            compareError={vm.compareError}
            bpmnCompare={vm.bpmnCompare}
            codeCompare={vm.codeCompare}
            onRefresh={vm.loadCompare}
          />
        ) : null}

        {vm.activeTab === "recommendations" ? (
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
        ) : null}

        {vm.activeTab === "report" ? (
          <ReportTab
            canViewReport={vm.permissions.canViewReport}
            reportState={vm.reportState}
            reportError={vm.reportError}
            report={vm.report}
            onRefresh={vm.loadReport}
            onRetry={vm.loadReport}
            onDownloadPdf={() => vm.downloadReport("pdf")}
          />
        ) : null}

        {vm.activeTab === "runs" ? <RunsTab runs={vm.data.runs} /> : null}
        {vm.activeTab === "members" ? (
          <MembersTab
            projectId={vm.data.project.id}
            initialMembers={vm.data.members}
            currentUserRole={vm.data.membership?.role}
          />
        ) : null}

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
      </ProjectDetailLayout>
    </div>
  );
}