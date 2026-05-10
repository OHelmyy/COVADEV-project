import { useState } from "react";
import {
  assignTask,
  evaluateTaskAssignment,
  reviewTaskAssignment,
} from "../api/taskManagementApi";
import AiSubmissionViewer from "./AiSubmissionViewer";
import type { Developer, TaskInfo, Assignment } from "../types";
import { getStatusLabel } from "../utils";
import { retryAiAssignment } from "../api/taskManagementApi";
import AiRetryForm from "./AiRetryForm";
import EvaluationForm from "./EvaluationForm";
import { buttonBase, inputBase, ui } from "../../../theme/ui";

type Props = {
  projectId: number;
  task: TaskInfo;
  assignment: Assignment | null;
  developers: Developer[];
  onChanged: () => Promise<void> | void;
  onError: (operation: string, error: unknown, title?: string) => void;
};
type SuitabilityTone = {
  bg: string;
  color: string;
  border: string;
  label: string;
};

function getSuitabilityTone(value?: string): SuitabilityTone {
  switch (value) {
    case "RECOMMENDED":
      return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0", label: "Recommended for AI" };
    case "NOT_RECOMMENDED":
      return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", label: "Not recommended for AI" };
    case "NEUTRAL":
      return { bg: "#fffbeb", color: "#b45309", border: "#fde68a", label: "Neutral" };
    default:
      return { bg: "#f3f4f6", color: "#4b5563", border: "#e5e7eb", label: "Not classified" };
  }
}

export default function TaskAssignmentRow({
  projectId,
  task,
  assignment,
  developers,
  onChanged,
  onError,
}: Props) {
  const [developerMembershipId, setDeveloperMembershipId] = useState<string>(
    assignment?.developer?.membershipId ? String(assignment.developer.membershipId) : ""
  );
  const [saving, setSaving] = useState(false);
  const [showEvaluationForm, setShowEvaluationForm] = useState(false);
  const [showAiSubmission, setShowAiSubmission] = useState(false);
  const [showAiRetryForm, setShowAiRetryForm] = useState(false);
  async function handleAssign() {
    if (!developerMembershipId) {
      onError(
        "assign task",
        new Error("No developer selected for this task."),
        "Task assignment failed"
      );
      return;
    }

    const selected = developers.find(
      (d) => String(d.membershipId) === developerMembershipId
    );

    if (
      selected?.isAiAgent &&
      task.aiSuitability === "NOT_RECOMMENDED"
    ) {
      const reasonText = task.aiSuitabilityReason
        ? `\n\nReason: ${task.aiSuitabilityReason}`
        : "";
      const ok = window.confirm(
        `This task is marked NOT RECOMMENDED for the AI agent.${reasonText}\n\nAssign anyway?`
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      await assignTask(projectId, {
        bpmnTaskId: task.id,
        developerMembershipId: Number(developerMembershipId),
        notes: "",
      });
      await onChanged();
    } catch (error: any) {
      onError("assign task", error, "Task assignment failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(accepted: boolean) {
    if (!assignment) return;

    setSaving(true);
    try {
      const res: any = await reviewTaskAssignment(assignment.assignmentId, {
        accepted,
        reviewNotes: "",
      });

      if (accepted && res?.aiWarning) {
        const w = res.aiWarning;
        window.alert(
          `Heads up: ${w.message}\n\n` +
          `If you want, you can:\n` +
          `- Send Back to AI with more specific feedback to raise the score, or\n` +
          `- Reassign this task to a human developer.`
        );
      }

      await onChanged();
    } catch (error: any) {
      onError(
        accepted ? "accept submitted task" : "reject submitted task",
        error,
        accepted ? "Task accept failed" : "Task reject failed"
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleAiRetry(feedback: string) {
      if (!assignment) return;
      setSaving(true);
      try {
        await retryAiAssignment(assignment.assignmentId, { feedback });
        setShowAiRetryForm(false);
        await onChanged();
      } catch (error: any) {
        onError("retry AI submission", error, "AI retry failed");
      } finally {
        setSaving(false);
      }
    }
  async function handleEvaluationSubmit(payload: {
    correctnessScore: number;
    qualityScore: number;
    timelinessScore: number;
    communicationScore: number;
    comments: string;
  }) {
    if (!assignment) return;

    setSaving(true);
    try {
      await evaluateTaskAssignment(assignment.assignmentId, payload);
      setShowEvaluationForm(false);
      await onChanged();
    } catch (error: any) {
      onError("save task evaluation", error, "Task evaluation failed");
    } finally {
      setSaving(false);
    }
  }

  function statusBadge() {
    const status = assignment?.status;
    const label = getStatusLabel(status);

    const tone =
      status === "ACCEPTED"
        ? { bg: ui.colors.successSoft, color: ui.colors.success }
        : status === "REJECTED"
        ? { bg: ui.colors.dangerSoft, color: ui.colors.danger }
        : status === "SUBMITTED"
        ? { bg: ui.colors.warningSoft, color: ui.colors.warning }
        : { bg: ui.colors.primarySoft, color: ui.colors.primary };

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "6px 10px",
          borderRadius: 999,
          background: tone.bg,
          color: tone.color,
          border: `1px solid ${ui.colors.border}`,
          fontWeight: 800,
          fontSize: 12,
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <>
      <tr>
        <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
          <div style={{ fontWeight: 800, color: ui.colors.text }}>{task.name}</div>
          <div style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 4 }}>
            {task.id}
          </div>
        </td>

        <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
          <select
            value={developerMembershipId}
            onChange={(e) => setDeveloperMembershipId(e.target.value)}
            style={{
              ...inputBase,
              minWidth: 200,
              padding: "10px 12px",
            }}
          >
            <option value="">Select developer</option>
            {developers.map((dev) => (
              <option key={dev.membershipId} value={dev.membershipId}>
                {dev.username}
              </option>
            ))}
          </select>

          {(() => {
            const selected = developers.find(
              (d) => String(d.membershipId) === developerMembershipId
            );
            if (!selected?.isAiAgent) return null;
            const tone = getSuitabilityTone(task.aiSuitability);
            return (
              <div
                title={task.aiSuitabilityReason || tone.label}
                style={{
                  marginTop: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: tone.bg,
                  color: tone.color,
                  border: `1px solid ${tone.border}`,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "help",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: tone.color,
                    display: "inline-block",
                  }}
                />
                {tone.label}
              </div>
            );
          })()}
        </td>

        <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
          <div>{statusBadge()}</div>
          {assignment?.evaluation && (
            <div style={{ marginTop: 8, fontSize: 12, color: ui.colors.textMuted }}>
              Score: <strong style={{ color: ui.colors.text }}>{assignment.evaluation.finalScore}</strong>
            </div>
          )}
        </td>

        <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Row 1 — Primary actions (Reassign, Accept, Reject, Evaluate) */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                onClick={handleAssign}
                disabled={saving}
                style={{
                  ...buttonBase,
                  padding: "8px 12px",
                  border: `1px solid ${ui.colors.borderStrong}`,
                  background: "#fff",
                  color: ui.colors.text,
                }}
              >
                {saving ? "Saving..." : assignment ? "Reassign" : "Assign"}
              </button>

              {assignment?.status === "SUBMITTED" && (
                <>
                  <button
                    onClick={() => handleReview(true)}
                    disabled={saving}
                    style={{
                      ...buttonBase,
                      padding: "8px 12px",
                      background: ui.colors.successSoft,
                      border: "1px solid #bbf7d0",
                      color: ui.colors.success,
                    }}
                  >
                    Accept
                  </button>

                  <button
                    onClick={() => handleReview(false)}
                    disabled={saving}
                    style={{
                      ...buttonBase,
                      padding: "8px 12px",
                      background: ui.colors.dangerSoft,
                      border: "1px solid #fecaca",
                      color: ui.colors.danger,
                    }}
                  >
                    Reject
                  </button>
                </>
              )}

              {assignment &&
              (assignment.status === "ACCEPTED" || assignment.status === "REJECTED") ? (
                <button
                  onClick={() => setShowEvaluationForm((v) => !v)}
                  disabled={saving}
                  style={{
                    ...buttonBase,
                    padding: "8px 12px",
                    background: ui.colors.primarySoft,
                    border: "1px solid #bfdbfe",
                    color: ui.colors.primary,
                  }}
                >
                  {assignment.evaluation ? "Update Evaluation" : "Evaluate"}
                </button>
              ) : null}
            </div>

            {/* Row 2 — AI-specific actions (only for AI assignments) */}
            {assignment?.developer?.isAiAgent && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  paddingTop: 6,
                  borderTop: `1px dashed ${ui.colors.border}`,
                }}
              >
                {["SUBMITTED", "ACCEPTED", "REJECTED"].includes(assignment.status) && (
                  <button
                    onClick={() => setShowAiSubmission((v) => !v)}
                    disabled={saving}
                    style={{
                      ...buttonBase,
                      padding: "8px 12px",
                      background: "#eef2ff",
                      border: "1px solid #c7d2fe",
                      color: "#3730a3",
                    }}
                  >
                    {showAiSubmission ? "Hide AI Work" : "View AI Work"}
                  </button>
                )}

                {assignment.status === "SUBMITTED" &&
                  (assignment.aiRetryCount ?? 0) < 2 && (
                    <button
                      onClick={() => setShowAiRetryForm((v) => !v)}
                      disabled={saving}
                      style={{
                        ...buttonBase,
                        padding: "8px 12px",
                        background: "#fff7ed",
                        border: "1px solid #fed7aa",
                        color: "#9a3412",
                      }}
                    >
                      {showAiRetryForm ? "Hide Retry Form" : "Send Back to AI"}
                    </button>
                  )}
              </div>
            )}
          </div>
        </td>
      </tr>

      {showEvaluationForm && assignment ? (
        <tr>
          <td colSpan={5} style={{ padding: 14, background: ui.colors.bgSoft }}>
            <EvaluationForm
              initialValues={
                assignment.evaluation
                  ? {
                      correctnessScore: assignment.evaluation.correctnessScore,
                      qualityScore: assignment.evaluation.qualityScore,
                      timelinessScore: assignment.evaluation.timelinessScore,
                      communicationScore: assignment.evaluation.communicationScore,
                      comments: assignment.evaluation.comments,
                    }
                  : null
              }
              onSubmit={handleEvaluationSubmit}
              onCancel={() => setShowEvaluationForm(false)}
              saving={saving}
            />
          </td>
        </tr>
      ) : null}
      {showAiSubmission && assignment ? (
        <tr>
          <td colSpan={5} style={{ padding: 14, background: ui.colors.bgSoft }}>
            <AiSubmissionViewer assignmentId={assignment.assignmentId} />
          </td>
        </tr>
      ) : null}
      {showAiRetryForm && assignment ? (
        <tr>
          <td colSpan={5} style={{ padding: 14, background: ui.colors.bgSoft }}>
            <AiRetryForm
              retryCount={assignment.aiRetryCount ?? 0}
              maxRetries={2}
              saving={saving}
              onSubmit={handleAiRetry}
              onCancel={() => setShowAiRetryForm(false)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}