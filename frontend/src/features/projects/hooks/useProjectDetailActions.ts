import { useCallback, useState } from "react";
import {
  deleteProject,
  generateRecommendations,
  runAnalysis,
  updateThreshold,
  uploadBpmn,
  uploadCodeZip,
} from "../../../api/projects";

type Params = {
  projectId: number;
  thresholdInput: string;
  reloadProject: () => Promise<void>;
  reloadResults: () => Promise<void>;
  reloadCompare: () => Promise<void>;
  reloadRecommendations: () => Promise<void>;
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
      const message = error instanceof Error ? error.message : String(error);
      setActionMsg(`BPMN upload failed: ${message}`);
    }
  }, [bpmnFile, projectId, reloadProject, reloadResults, reloadCompare]);

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
      const message = error instanceof Error ? error.message : String(error);
      setActionMsg(`Code ZIP upload failed: ${message}`);
    }
  }, [codeZip, projectId, reloadProject, reloadResults, reloadCompare]);

  const onRunAnalysis = useCallback(async () => {
    setActionMsg("Running analysis...");

    try {
      const response = await runAnalysis(projectId);
      setActionMsg(`Analysis: ${response?.run?.status ?? "DONE"} ✅`);

      await reloadProject();
      await reloadResults();
      await reloadCompare();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMsg(`Analysis failed: ${message}`);
    }
  }, [projectId, reloadProject, reloadResults, reloadCompare]);

  const onUpdateThreshold = useCallback(async () => {
    setActionMsg("Updating threshold...");

    try {
      await updateThreshold(projectId, Number(thresholdInput));
      setActionMsg("Threshold updated ✅");

      await reloadProject();
      await reloadResults();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMsg(`Update failed: ${message}`);
    }
  }, [projectId, thresholdInput, reloadProject, reloadResults]);

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
      const message = error instanceof Error ? error.message : String(error);
      setActionMsg(`Delete failed: ${message}`);
      setDeletingProject(false);
      setShowDeleteModal(false);
    }
  }, [deletingProject, projectId]);

  const onGenerateRecommendations = useCallback(async () => {
    setActionMsg("Generating recommendations...");

    try {
      await generateRecommendations(projectId);
      await reloadRecommendations();
      setActionMsg("Recommendations generated ✅");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMsg(`Generate failed: ${message}`);
    }
  }, [projectId, reloadRecommendations]);

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
  };
}