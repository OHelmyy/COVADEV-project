import { useCallback, useState } from "react";
import {
  deleteProject,
  generateRecommendations,
  runAnalysis,
  updateThreshold,
  uploadBpmn,
  uploadCodeZip,
} from "../../../api/projects";
import { buildProjectError } from "../utils/projectError";

type Params = {
  projectId: number;
  thresholdInput: string;
  reloadProject: () => Promise<void>;
  reloadResults: () => Promise<void>;
  reloadCompare: () => Promise<void>;
  reloadRecommendations: () => Promise<void>;
};

type ProjectErrorModalState = {
  open: boolean;
  title: string;
  message: string;
  cause: string;
  details: string;
};

const EMPTY_ERROR_MODAL: ProjectErrorModalState = {
  open: false,
  title: "",
  message: "",
  cause: "",
  details: "",
};

export function useProjectDetailActions({
  projectId,
  thresholdInput,
  reloadProject,
  reloadResults,
  reloadCompare,
  reloadRecommendations,
}: Params) {
  const [actionMsg, setActionMsg] = useState("");
  const [bpmnFile, setBpmnFile] = useState<File | null>(null);
  const [codeZip, setCodeZip] = useState<File | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  const [errorModal, setErrorModal] = useState<ProjectErrorModalState>(EMPTY_ERROR_MODAL);

  const openErrorModal = useCallback(
    (operation: string, error: unknown, fallbackTitle?: string) => {
      const info = buildProjectError(operation, error, fallbackTitle);
      setErrorModal({
        open: true,
        title: info.title,
        message: info.message,
        cause: info.cause,
        details: info.details,
      });
    },
    []
  );

  const closeErrorModal = useCallback(() => {
    setErrorModal(EMPTY_ERROR_MODAL);
  }, []);

  const onUploadBpmn = useCallback(async () => {
    if (!bpmnFile) return;

    setActionMsg("Uploading BPMN...");

    try {
      await uploadBpmn(projectId, bpmnFile);
      setActionMsg("BPMN uploaded ✅");
      setBpmnFile(null);

      await reloadProject();
      await reloadResults();
      await reloadCompare();
    } catch (error: unknown) {
      setActionMsg("");
      openErrorModal("upload BPMN", error, "BPMN upload failed");
    }
  }, [bpmnFile, projectId, reloadProject, reloadResults, reloadCompare, openErrorModal]);

  const onUploadCode = useCallback(async () => {
    if (!codeZip) return;

    setActionMsg("Uploading Code ZIP...");

    try {
      await uploadCodeZip(projectId, codeZip);
      setActionMsg("Code ZIP uploaded & indexed ✅");
      setCodeZip(null);

      await reloadProject();
      await reloadResults();
      await reloadCompare();
    } catch (error: unknown) {
      setActionMsg("");
      openErrorModal("upload code ZIP", error, "Code upload failed");
    }
  }, [codeZip, projectId, reloadProject, reloadResults, reloadCompare, openErrorModal]);

  const onRunAnalysis = useCallback(async () => {
    setActionMsg("Running analysis...");

    try {
      const response = await runAnalysis(projectId);
      setActionMsg(`Analysis: ${response?.run?.status ?? "DONE"} ✅`);

      await reloadProject();
      await reloadResults();
      await reloadCompare();
    } catch (error: unknown) {
      setActionMsg("");
      openErrorModal("run analysis", error, "Analysis failed");
    }
  }, [projectId, reloadProject, reloadResults, reloadCompare, openErrorModal]);

  const onUpdateThreshold = useCallback(async () => {
    setActionMsg("Updating threshold...");

    try {
      await updateThreshold(projectId, Number(thresholdInput));
      setActionMsg("Threshold updated ✅");

      await reloadProject();
      await reloadResults();
    } catch (error: unknown) {
      setActionMsg("");
      openErrorModal("update threshold", error, "Threshold update failed");
    }
  }, [projectId, thresholdInput, reloadProject, reloadResults, openErrorModal]);

  const onDeleteProject = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteProject = useCallback(async () => {
    if (deletingProject) return;

    setDeletingProject(true);
    setActionMsg("Deleting project...");

    try {
      await deleteProject(projectId);
      setShowDeleteModal(false);
      setActionMsg("");
      window.location.href = "/projects";
    } catch (error: unknown) {
      setActionMsg("");
      setDeletingProject(false);
      setShowDeleteModal(false);
      openErrorModal("delete project", error, "Project deletion failed");
    }
  }, [deletingProject, projectId, openErrorModal]);

  const onGenerateRecommendations = useCallback(async () => {
    setActionMsg("Generating recommendations...");

    try {
      await generateRecommendations(projectId);
      await reloadRecommendations();
      setActionMsg("Recommendations generated ✅");
    } catch (error: unknown) {
      setActionMsg("");
      openErrorModal("generate recommendations", error, "Recommendation generation failed");
    }
  }, [projectId, reloadRecommendations, openErrorModal]);

  return {
    actionMsg,
    setActionMsg,
    bpmnFile,
    setBpmnFile,
    codeZip,
    setCodeZip,
    showDeleteModal,
    setShowDeleteModal,
    deletingProject,
    onUploadBpmn,
    onUploadCode,
    onRunAnalysis,
    onUpdateThreshold,
    onDeleteProject,
    confirmDeleteProject,
    onGenerateRecommendations,

    errorModal,
    openErrorModal,
    closeErrorModal,
  };
}