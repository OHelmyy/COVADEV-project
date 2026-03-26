import { useState } from "react";
import { assignTask, evaluateTaskAssignment, reviewTaskAssignment } from "../api/taskManagementApi";

import type { Developer, TaskInfo, Assignment } from "../types";
import { getStatusLabel } from "../utils";

import EvaluationForm from "./EvaluationForm";
type Props = {
  projectId: number;
  task: TaskInfo;
  assignment: Assignment | null;
  developers: Developer[];
  onChanged: () => Promise<void> | void;
};

export default function TaskAssignmentRow({
  projectId,
  task,
  assignment,
  developers,
  onChanged,
}: Props) {
  const [developerMembershipId, setDeveloperMembershipId] = useState<string>(
    assignment?.developer?.membershipId
      ? String(assignment.developer.membershipId)
      : ""
  );
  const [saving, setSaving] = useState(false);

  const [showEvaluationForm, setShowEvaluationForm] = useState(false);

  async function handleAssign() {
    if (!developerMembershipId) {
      alert("Please select a developer first.");
      return;
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
      alert(error.message || "Failed to assign task.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(accepted: boolean) {
    if (!assignment) return;

    setSaving(true);
    try {
      await reviewTaskAssignment(assignment.assignmentId, {
        accepted,
        reviewNotes: "",
      });
      await onChanged();
    } catch (error: any) {
      alert(error.message || "Failed to review task.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEvaluateClick() {
  if (!assignment) return;

  const correctnessScore = Number(prompt("Correctness score (0-100)", "80"));
  const qualityScore = Number(prompt("Quality score (0-100)", "80"));
  const timelinessScore = Number(prompt("Timeliness score (0-100)", "80"));
  const communicationScore = Number(prompt("Communication score (0-100)", "80"));
  const comments = prompt("Comments", "") || "";

  if (
    Number.isNaN(correctnessScore) ||
    Number.isNaN(qualityScore) ||
    Number.isNaN(timelinessScore) ||
    Number.isNaN(communicationScore)
  ) {
    alert("Invalid scores.");
    return;
  }

  try {
    await evaluateTaskAssignment(assignment.assignmentId, {
      correctnessScore,
      qualityScore,
      timelinessScore,
      communicationScore,
      comments,
    });
    await onChanged();
  } catch (error: any) {
    alert(error.message || "Failed to evaluate task.");
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
    alert(error.message || "Failed to evaluate task.");
  } finally {
    setSaving(false);
  }
}

  return (
    <>
    <tr style={{ borderTop: "1px solid #eee" }}>
      <td style={{ padding: 10 }}>{task.name}</td>
      <td style={{ padding: 10 }}>
        <select
          value={developerMembershipId}
          onChange={(e) => setDeveloperMembershipId(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, minWidth: 180 }}
        >
          <option value="">Select developer</option>
          {developers.map((dev) => (
            <option key={dev.membershipId} value={dev.membershipId}>
              {dev.username}
            </option>
          ))}
        </select>
      </td>
     <td style={{ padding: 10 }}>
      <div>{getStatusLabel(assignment?.status)}</div>
      {assignment?.evaluation && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
          Score: <strong>{assignment.evaluation.finalScore}</strong>
        </div>
      )}
    </td>
      <td style={{ padding: 10 }}>
        <button
          onClick={handleAssign}
          disabled={saving}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            cursor: "pointer",
            marginRight: 8,
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
                marginRight: 6,
                background: "#e6f7e6",
                border: "1px solid #b7e4c7",
                borderRadius: 6,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Accept
            </button>

            <button
              onClick={() => handleReview(false)}
              disabled={saving}
              style={{
                background: "#fdeaea",
                border: "1px solid #f5c2c7",
                borderRadius: 6,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Reject
            </button>
          </>
        )}
        {assignment &&
        (assignment.status === "ACCEPTED" || assignment.status === "REJECTED") && (
          <button
            onClick={() => setShowEvaluationForm((v) => !v)}
            disabled={saving}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
            {assignment.evaluation ? "Update Evaluation" : "Evaluate"}
          </button>
        )}
      </td>
    </tr>
    
    {showEvaluationForm && assignment && (
    <tr>
      <td colSpan={5} style={{ padding: 10 }}>
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
  )}
  </>
  );
}