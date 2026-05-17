import React, { useEffect, useRef, useState } from "react";
import {
  getMyTaskAssignments,
  startTaskAssignment,
  submitTaskAssignment,
} from "../api/taskManagementApi";
import { submitZip } from "../../../api/projects";
import type { AssignmentWithTask } from "../types";
import { getStatusLabel } from "../utils";
import { buttonBase, cardBase, ui, inputBase } from "../../../theme/ui";
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

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  ASSIGNED:      { bg: "#eff6ff", fg: "#1e40af" },
  IN_PROGRESS:   { bg: "#f0fdf4", fg: "#166534" },
  SUBMITTED:     { bg: "#fef3c7", fg: "#92400e" },
  UNDER_REVIEW:  { bg: "#fef3c7", fg: "#92400e" },
  NEEDS_CHANGES: { bg: "#f5f3ff", fg: "#5b21b6" },
  ACCEPTED:      { bg: "#ecfdf5", fg: "#065f46" },
  REJECTED:      { bg: "#fef2f2", fg: "#991b1b" },
  MERGED:        { bg: "#ecfdf5", fg: "#065f46" },
};

export default function MyTasksTab() {
  const [items, setItems] = useState<AssignmentWithTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorModal, setErrorModal] = useState<ErrorState>(EMPTY_ERROR);

  // Form states per assignment
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [submitMethod, setSubmitMethod] = useState<Record<number, "github" | "zip">>({});
  const [prNumber, setPrNumber] = useState<Record<number, string>>({});
  const [prUrl, setPrUrl] = useState<Record<number, string>>({});
  const [subNote, setSubNote] = useState<Record<number, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [actionMsg, setActionMsg] = useState<Record<number, string>>({});

  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

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

  async function handleStartTask(assignmentId: number) {
    setActionLoading((prev) => ({ ...prev, [assignmentId]: true }));
    setActionMsg((prev) => ({ ...prev, [assignmentId]: "" }));
    try {
      await startTaskAssignment(assignmentId);
      setActionMsg((prev) => ({ ...prev, [assignmentId]: "✓ Task started successfully!" }));
      await loadMyTasks();
    } catch (e: any) {
      setActionMsg((prev) => ({ ...prev, [assignmentId]: `Error: ${e.message}` }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [assignmentId]: false }));
    }
  }

  async function handleGitHubSubmit(assignmentId: number, projectId: number) {
    const num = prNumber[assignmentId] ? Number(prNumber[assignmentId]) : null;
    const note = subNote[assignmentId] || "";

    if (!num) {
      alert("Please enter the Pull Request Number.");
      return;
    }

    setActionLoading((prev) => ({ ...prev, [assignmentId]: true }));
    setActionMsg((prev) => ({ ...prev, [assignmentId]: "" }));
    try {
      await submitTaskAssignment(assignmentId, {
        githubPrNumber: num,
        githubPrUrl: "", // Handled automatically by backend using repo url + pr number
        submissionNotes: note,
      });
      setActionMsg((prev) => ({ ...prev, [assignmentId]: "✓ Task submitted successfully!" }));
      setPrNumber((prev) => ({ ...prev, [assignmentId]: "" }));
      setSubNote((prev) => ({ ...prev, [assignmentId]: "" }));
      setExpandedId(null);
      await loadMyTasks();
    } catch (e: any) {
      setActionMsg((prev) => ({ ...prev, [assignmentId]: `Error: ${e.message}` }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [assignmentId]: false }));
    }
  }

  async function handleZipSubmit(assignmentId: number, projectId: number, file: File) {
    setActionLoading((prev) => ({ ...prev, [assignmentId]: true }));
    setActionMsg((prev) => ({ ...prev, [assignmentId]: "" }));
    try {
      await submitZip(projectId, assignmentId, file);
      setActionMsg((prev) => ({ ...prev, [assignmentId]: "✓ ZIP submitted successfully!" }));
      setExpandedId(null);
      await loadMyTasks();
    } catch (e: any) {
      setActionMsg((prev) => ({ ...prev, [assignmentId]: `Error: ${e.message}` }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [assignmentId]: false }));
      if (fileRefs.current[assignmentId]) {
        fileRefs.current[assignmentId]!.value = "";
      }
    }
  }

  function statusBadge(status: string) {
    const label = getStatusLabel(status);
    const tone = STATUS_COLORS[status] ?? { bg: "#f3f4f6", fg: "#6b7280" };

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
            Start, track, and submit your assigned tasks across your active projects.
          </div>
        </div>

        <div style={{ ...cardBase, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: ui.colors.bgSoft, borderBottom: `1px solid ${ui.colors.border}` }}>
                  <th style={{ textAlign: "left", padding: 14 }}>Project Name</th>
                  <th style={{ textAlign: "left", padding: 14 }}>BPMN Task</th>
                  <th style={{ textAlign: "left", padding: 14 }}>GitHub Branch</th>
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
                  items.map((item) => {
                    const isExpanded = expandedId === item.assignmentId;
                    const activeMethod = submitMethod[item.assignmentId] || "github";

                    return (
                      <React.Fragment key={item.assignmentId}>
                        <tr>
                          <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}`, fontWeight: 700, color: ui.colors.text }}>
                            {(item as any).projectName || `Project #${item.projectId}`}
                          </td>
                          <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                            <div style={{ fontWeight: 800, color: ui.colors.text }}>{item.task.name}</div>
                            <div style={{ color: ui.colors.textMuted, fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>
                              {item.task.taskId}
                            </div>
                          </td>
                          <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                            {item.githubBranch ? (
                              <code style={{ background: "#eff6ff", color: "#1e40af", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                                {item.githubBranch}
                              </code>
                            ) : "—"}
                          </td>
                          <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                            {statusBadge(item.status)}
                          </td>
                          <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              {item.status === "ASSIGNED" && (
                                <button
                                  onClick={() => handleStartTask(item.assignmentId)}
                                  disabled={actionLoading[item.assignmentId]}
                                  style={{
                                    ...buttonBase,
                                    padding: "8px 14px",
                                    background: "#6366f1",
                                    color: "#fff",
                                    fontWeight: 800,
                                    fontSize: 12,
                                  }}
                                >
                                  {actionLoading[item.assignmentId] ? "Starting..." : "Start Task"}
                                </button>
                              )}

                              {["IN_PROGRESS", "NEEDS_CHANGES"].includes(item.status) && (
                                <button
                                  onClick={() => setExpandedId(isExpanded ? null : item.assignmentId)}
                                  style={{
                                    ...buttonBase,
                                    padding: "8px 14px",
                                    background: isExpanded ? ui.colors.textMuted : ui.colors.primary,
                                    color: "#fff",
                                    fontWeight: 800,
                                    fontSize: 12,
                                  }}
                                >
                                  {isExpanded ? "Cancel" : "Submit Work"}
                                </button>
                              )}

                              <a
                                href={`/projects/${item.projectId}`}
                                style={{
                                  ...buttonBase,
                                  padding: "8px 12px",
                                  border: `1px solid ${ui.colors.borderStrong}`,
                                  background: "#fff",
                                  color: ui.colors.text,
                                  textDecoration: "none",
                                  display: "inline-block",
                                  fontSize: 12,
                                }}
                              >
                                Go to Project →
                              </a>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={5} style={{ padding: "16px 20px", background: "#f8fafc", borderBottom: `1px solid ${ui.colors.border}` }}>
                              <div>
                                <h5 style={{ margin: "0 0 12px 0", fontSize: 14, color: ui.colors.text }}>Submit Assignment</h5>
                                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                  <button
                                    onClick={() => setSubmitMethod((prev) => ({ ...prev, [item.assignmentId]: "github" }))}
                                    style={{
                                      ...buttonBase,
                                      padding: "6px 12px",
                                      background: activeMethod === "github" ? ui.colors.primary : "#e2e8f0",
                                      color: activeMethod === "github" ? "#fff" : ui.colors.text,
                                      fontWeight: 700,
                                      fontSize: 12,
                                    }}
                                  >
                                    🔗 Submit via GitHub PR
                                  </button>
                                  <button
                                    onClick={() => setSubmitMethod((prev) => ({ ...prev, [item.assignmentId]: "zip" }))}
                                    style={{
                                      ...buttonBase,
                                      padding: "6px 12px",
                                      background: activeMethod === "zip" ? ui.colors.primary : "#e2e8f0",
                                      color: activeMethod === "zip" ? "#fff" : ui.colors.text,
                                      fontWeight: 700,
                                      fontSize: 12,
                                    }}
                                  >
                                    📦 Submit via ZIP File
                                  </button>
                                </div>

                                {activeMethod === "github" ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 600 }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: ui.colors.textMuted }}>
                                        PR Number
                                      </label>
                                      <input
                                        type="number"
                                        placeholder="e.g. 23"
                                        value={prNumber[item.assignmentId] || ""}
                                        onChange={(e) => setPrNumber((prev) => ({ ...prev, [item.assignmentId]: e.target.value }))}
                                        style={{ ...inputBase, width: "100%", padding: "6px 10px", fontSize: 13, maxWidth: 200 }}
                                      />
                                      <small style={{ color: ui.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                                        🔗 The system will automatically generate your GitHub Pull Request link.
                                      </small>
                                    </div>

                                    <div>
                                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: ui.colors.textMuted }}>
                                        Submission Note
                                      </label>
                                      <textarea
                                        rows={2}
                                        placeholder="Note for evaluator..."
                                        value={subNote[item.assignmentId] || ""}
                                        onChange={(e) => setSubNote((prev) => ({ ...prev, [item.assignmentId]: e.target.value }))}
                                        style={{ ...inputBase, width: "100%", padding: "6px 10px", resize: "vertical", fontSize: 13 }}
                                      />
                                    </div>

                                    <button
                                      onClick={() => handleGitHubSubmit(item.assignmentId, item.projectId)}
                                      disabled={actionLoading[item.assignmentId]}
                                      style={{
                                        ...buttonBase,
                                        alignSelf: "flex-start",
                                        padding: "8px 16px",
                                        background: ui.colors.primary,
                                        color: "#fff",
                                        fontWeight: 800,
                                        fontSize: 12,
                                      }}
                                    >
                                      {actionLoading[item.assignmentId] ? "Submitting..." : "Submit via PR"}
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <input
                                      type="file"
                                      accept=".zip"
                                      ref={(el) => { fileRefs.current[item.assignmentId] = el; }}
                                      style={{ display: "none" }}
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleZipSubmit(item.assignmentId, item.projectId, f);
                                      }}
                                    />
                                    <button
                                      onClick={() => fileRefs.current[item.assignmentId]?.click()}
                                      disabled={actionLoading[item.assignmentId]}
                                      style={{
                                        ...buttonBase,
                                        padding: "8px 16px",
                                        background: ui.colors.primary,
                                        color: "#fff",
                                        fontWeight: 700,
                                        fontSize: 12,
                                      }}
                                    >
                                      {actionLoading[item.assignmentId] ? "Uploading…" : "Upload ZIP File"}
                                    </button>
                                  </div>
                                )}

                                {actionMsg[item.assignmentId] && (
                                  <div
                                    style={{
                                      marginTop: 10,
                                      fontSize: 12,
                                      fontWeight: 700,
                                      color: actionMsg[item.assignmentId].startsWith("Error") ? ui.colors.danger : ui.colors.success,
                                    }}
                                  >
                                    {actionMsg[item.assignmentId]}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
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