import React, { useState } from "react";
import { assignTask, reviewTaskAssignment } from "../api/taskManagementApi";

import type { Developer, TaskInfo, Assignment } from "../types";
import { getStatusLabel } from "../utils";

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

  return (
    <tr style={{ borderTop: "1px solid #eee" }}>
      <td style={{ padding: 10 }}>{task.taskId}</td>
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
      <td style={{ padding: 10 }}>{getStatusLabel(assignment?.status)}</td>
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
      </td>
    </tr>
  );
}