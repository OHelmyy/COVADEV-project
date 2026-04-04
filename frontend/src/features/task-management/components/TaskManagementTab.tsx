import { useEffect, useState } from "react";
import TaskAssignmentRow from "./TaskAssignmentRow";
import {
  getProjectDevelopers,
  getProjectTaskAssignments,
} from "../api/taskManagementApi";
import type { Developer, TaskAssignmentItem } from "../types";
import { cardBase, ui } from "../../../theme/ui";

type Props = {
  projectId: number;
};

export default function TaskManagementTab({ projectId }: Props) {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadTaskAssignmentsOnly() {
    const taskData = await getProjectTaskAssignments(projectId);
    setTaskAssignments(taskData.items || []);
  }

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [devData, taskData] = await Promise.all([
        getProjectDevelopers(projectId),
        getProjectTaskAssignments(projectId),
      ]);

      setDevelopers(devData.developers || []);
      setTaskAssignments(taskData.items || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) {
      loadAll();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ ...cardBase, padding: 18 }}>
        <div style={{ fontWeight: 900 }}>Loading task management...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          ...cardBase,
          padding: 18,
          background: ui.colors.dangerSoft,
          borderColor: "#fecaca",
          color: ui.colors.danger,
          fontWeight: 700,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          ...cardBase,
          padding: 18,
          background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
          color: "#fff",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 22 }}>Task Management</h3>
        <div style={{ marginTop: 8, opacity: 0.95, lineHeight: 1.6 }}>
          Assign extracted BPMN tasks to project developers and review submitted work.
        </div>
      </div>

      <div style={{ ...cardBase, padding: 16 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div
            style={{
              padding: 14,
              borderRadius: ui.radius.lg,
              background: ui.colors.bgSoft,
              border: `1px solid ${ui.colors.border}`,
              minWidth: 180,
            }}
          >
            <div style={{ fontSize: 13, color: ui.colors.textMuted }}>Developers</div>
            <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24 }}>{developers.length}</div>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: ui.radius.lg,
              background: ui.colors.bgSoft,
              border: `1px solid ${ui.colors.border}`,
              minWidth: 180,
            }}
          >
            <div style={{ fontSize: 13, color: ui.colors.textMuted }}>Extracted Tasks</div>
            <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24 }}>{taskAssignments.length}</div>
          </div>
        </div>
      </div>

      <div style={{ ...cardBase, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: ui.colors.bgSoft }}>
                <th style={{ textAlign: "left", padding: 14 }}>Task Name</th>
                <th style={{ textAlign: "left", padding: 14 }}>Assigned Developer</th>
                <th style={{ textAlign: "left", padding: 14 }}>Status</th>
                <th style={{ textAlign: "left", padding: 14 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {taskAssignments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 20, color: ui.colors.textMuted, textAlign: "center" }}>
                    No extracted tasks found for this project.
                  </td>
                </tr>
              ) : (
                taskAssignments.map((item) => (
                  <TaskAssignmentRow
                    key={item.task.id}
                    projectId={projectId}
                    task={item.task}
                    assignment={item.assignment}
                    developers={developers}
                    onChanged={loadTaskAssignmentsOnly}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}