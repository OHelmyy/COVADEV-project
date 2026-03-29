import  { useEffect, useState } from "react";
import {
  getMyTaskAssignments,
  startTaskAssignment,
  submitTaskAssignment,
} from "../api/taskManagementApi";
import type { AssignmentWithTask } from "../types";
import { getStatusLabel } from "../utils";

export default function MyTasksTab() {
  const [items, setItems] = useState<AssignmentWithTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadMyTasks() {
    setLoading(true);
    setError("");

    try {
      const data = await getMyTaskAssignments();
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load my tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyTasks();
  }, []);

  async function handleStart(assignmentId: number) {
    try {
      await startTaskAssignment(assignmentId);
      await loadMyTasks();
    } catch (err: any) {
      alert(err.message || "Failed to start task");
    }
  }

  async function handleSubmit(assignmentId: number) {
    try {
      await submitTaskAssignment(assignmentId, {
        submissionNotes: "Completed",
      });
      await loadMyTasks();
    } catch (err: any) {
      alert(err.message || "Failed to submit task");
    }
  }

  if (loading) {
    return <div>Loading my tasks...</div>;
  }

  if (error) {
    return <div style={{ color: "crimson" }}>{error}</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>My Tasks</h3>
        <div style={{ color: "#666", marginTop: 6 }}>
          Start, track, and submit your assigned tasks.
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: 10 }}>Task ID</th>
              <th style={{ textAlign: "left", padding: 10 }}>Task Name</th>
              <th style={{ textAlign: "left", padding: 10 }}>Project</th>
              <th style={{ textAlign: "left", padding: 10 }}>Status</th>
              <th style={{ textAlign: "left", padding: 10 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 12, color: "#777" }}>
                  No tasks assigned to you yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.assignmentId} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 10 }}>{item.task.taskId}</td>
                  <td style={{ padding: 10 }}>{item.task.name}</td>
                  <td style={{ padding: 10 }}>{item.projectId}</td>
                  <td style={{ padding: 10 }}>{getStatusLabel(item.status)}</td>
                  <td style={{ padding: 10 }}>
                    {item.status === "ASSIGNED" && (
                      <button
                        onClick={() => handleStart(item.assignmentId)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          cursor: "pointer",
                        }}
                      >
                        Start
                      </button>
                    )}

                    {item.status === "IN_PROGRESS" && (
                      <button
                        onClick={() => handleSubmit(item.assignmentId)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          cursor: "pointer",
                        }}
                      >
                        Submit
                      </button>
                    )}

                    {item.status !== "ASSIGNED" && item.status !== "IN_PROGRESS" && (
                      <span style={{ color: "#777" }}>No action</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}