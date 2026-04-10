import { useEffect, useState } from "react";
import {
  getMyTaskAssignments,
  startTaskAssignment,
  submitTaskAssignment,
} from "../api/taskManagementApi";
import type { AssignmentWithTask } from "../types";
import { getStatusLabel } from "../utils";
import { buttonBase, cardBase, ui } from "../../../theme/ui";
import ErrorModal from "../../../components/ErrorModal";
import { buildTaskManagementError } from "../utils/taskManagementError";

type ErrorState = {
  open: boolean;
  title: string;
  message: string;
  cause: string;
  details: string;
};

const EMPTY_ERROR: ErrorState = {
  open: false,
  title: "",
  message: "",
  cause: "",
  details: "",
};

export default function MyTasksTab() {
  const [items, setItems] = useState<AssignmentWithTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorModal, setErrorModal] = useState<ErrorState>(EMPTY_ERROR);

  function openTaskError(operation: string, err: unknown, title?: string) {
    const info = buildTaskManagementError(operation, err, title);
    setErrorModal({
      open: true,
      title: info.title,
      message: info.message,
      cause: info.cause,
      details: info.details,
    });
  }

  async function loadMyTasks() {
    setLoading(true);
    setError("");

    try {
      const data = await getMyTaskAssignments();
      setItems(data.items || []);
    } catch (err: any) {
      const message = err.message || "Failed to load my tasks";
      setError(message);
      openTaskError("load my tasks", err, "My tasks load failed");
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
      openTaskError("start task", err, "Task start failed");
    }
  }

  async function handleSubmit(assignmentId: number) {
    try {
      await submitTaskAssignment(assignmentId, {
        submissionNotes: "Completed",
      });
      await loadMyTasks();
    } catch (err: any) {
      openTaskError("submit task", err, "Task submit failed");
    }
  }

  function statusBadge(status: string) {
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
          fontWeight: 800,
          fontSize: 12,
          border: `1px solid ${ui.colors.border}`,
        }}
      >
        {label}
      </span>
    );
  }

  if (loading) {
    return (
      <div style={{ ...cardBase, padding: 18 }}>
        <div style={{ fontWeight: 900 }}>Loading my tasks...</div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <>
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

        <ErrorModal
          open={errorModal.open}
          title={errorModal.title}
          message={errorModal.message}
          cause={errorModal.cause}
          details={errorModal.details}
          onClose={() => setErrorModal(EMPTY_ERROR)}
        />
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            ...cardBase,
            padding: 18,
            background: "linear-gradient(135deg, #0f3d91 0%, #6d28d9 100%)",
            color: "#fff",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 22 }}>My Tasks</h3>
          <div style={{ marginTop: 8, opacity: 0.95 }}>
            Start, track, and submit your assigned tasks.
          </div>
        </div>

        <div style={{ ...cardBase, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: ui.colors.bgSoft, borderBottom: `1px solid ${ui.colors.border}` }}>
                  <th style={{ textAlign: "left", padding: 14 }}>Task ID</th>
                  <th style={{ textAlign: "left", padding: 14 }}>Task Name</th>
                  <th style={{ textAlign: "left", padding: 14 }}>Project</th>
                  <th style={{ textAlign: "left", padding: 14 }}>Status</th>
                  <th style={{ textAlign: "left", padding: 14 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 20, color: ui.colors.textMuted, textAlign: "center" }}>
                      No tasks assigned to you yet.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.assignmentId}>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                        <span style={{ fontFamily: "monospace", color: ui.colors.textSoft }}>
                          {item.task.taskId}
                        </span>
                      </td>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}`, fontWeight: 800 }}>
                        {item.task.name}
                      </td>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {item.projectId}
                      </td>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {statusBadge(item.status)}
                      </td>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {item.status === "ASSIGNED" && (
                          <button
                            onClick={() => handleStart(item.assignmentId)}
                            style={{
                              ...buttonBase,
                              padding: "8px 12px",
                              border: `1px solid ${ui.colors.borderStrong}`,
                              background: "#fff",
                              color: ui.colors.text,
                            }}
                          >
                            Start
                          </button>
                        )}

                        {item.status === "IN_PROGRESS" && (
                          <button
                            onClick={() => handleSubmit(item.assignmentId)}
                            style={{
                              ...buttonBase,
                              padding: "8px 12px",
                              border: "1px solid transparent",
                              background: ui.colors.primary,
                              color: "#fff",
                            }}
                          >
                            Submit
                          </button>
                        )}

                        {item.status !== "ASSIGNED" && item.status !== "IN_PROGRESS" && (
                          <span style={{ color: ui.colors.textMuted }}>No action</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ErrorModal
        open={errorModal.open}
        title={errorModal.title}
        message={errorModal.message}
        cause={errorModal.cause}
        details={errorModal.details}
        onClose={() => setErrorModal(EMPTY_ERROR)}
      />
    </>
  );
}