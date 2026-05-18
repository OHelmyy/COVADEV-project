import { useEffect, useRef, useState } from "react";
import { submitZip } from "../../../../../api/projects";
import {
  getMyTaskAssignments,
  startTaskAssignment,
  submitTaskAssignment,
} from "../../../../task-management/api/taskManagementApi";
import type { AssignmentWithTask } from "../../../../task-management/types";
import { Card } from "../ProjectUi";
import { buttonBase, inputBase, ui, cardBase } from "../../../../../theme/ui";

type Props = { projectId: number };

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  ASSIGNED: { bg: "#eff6ff", fg: "#1e40af" },
  IN_PROGRESS: { bg: "#f0fdf4", fg: "#166534" },
  SUBMITTED: { bg: "#fef3c7", fg: "#92400e" },
  UNDER_REVIEW: { bg: "#fef3c7", fg: "#92400e" },
  NEEDS_CHANGES: { bg: "#f5f3ff", fg: "#5b21b6" },
  ACCEPTED: { bg: "#ecfdf5", fg: "#065f46" },
  REJECTED: { bg: "#fef2f2", fg: "#991b1b" },
  MERGED: { bg: "#ecfdf5", fg: "#065f46" },
};

export default function MyTasksTab({ projectId }: Props) {
  const [tasks, setTasks] = useState<AssignmentWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Submit state per assignment
  const [submitMethod, setSubmitMethod] = useState<Record<number, "github" | "zip">>({});
  const [prNumber, setPrNumber] = useState<Record<number, string>>({});
  const [prUrl, setPrUrl] = useState<Record<number, string>>({});
  const [subNote, setSubNote] = useState<Record<number, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [actionMsg, setActionMsg] = useState<Record<number, string>>({});

  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await getMyTaskAssignments();
      // filter tasks by project id
      const filtered = (res.items || []).filter((item) => item.projectId === projectId);
      setTasks(filtered);
    } catch (e: any) {
      setError(e.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function handleStartTask(assignmentId: number) {
    setActionLoading((prev) => ({ ...prev, [assignmentId]: true }));
    setActionMsg((prev) => ({ ...prev, [assignmentId]: "" }));
    try {
      await startTaskAssignment(assignmentId);
      setActionMsg((prev) => ({ ...prev, [assignmentId]: "✓ Task started successfully!" }));
      await load();
    } catch (e: any) {
      setActionMsg((prev) => ({ ...prev, [assignmentId]: `Error: ${e.message}` }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [assignmentId]: false }));
    }
  }

  async function handleGitHubSubmit(assignmentId: number) {
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
      // Clear forms
      setPrNumber((prev) => ({ ...prev, [assignmentId]: "" }));
      setSubNote((prev) => ({ ...prev, [assignmentId]: "" }));
      await load();
    } catch (e: any) {
      setActionMsg((prev) => ({ ...prev, [assignmentId]: `Error: ${e.message}` }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [assignmentId]: false }));
    }
  }

  async function handleZipSubmit(assignmentId: number, file: File) {
    setActionLoading((prev) => ({ ...prev, [assignmentId]: true }));
    setActionMsg((prev) => ({ ...prev, [assignmentId]: "" }));
    try {
      await submitZip(projectId, assignmentId, file);
      setActionMsg((prev) => ({ ...prev, [assignmentId]: "✓ ZIP submitted successfully!" }));
      await load();
    } catch (e: any) {
      setActionMsg((prev) => ({ ...prev, [assignmentId]: `Error: ${e.message}` }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [assignmentId]: false }));
      if (fileRefs.current[assignmentId]) {
        fileRefs.current[assignmentId]!.value = "";
      }
    }
  }

  if (loading) return <Card><div style={{ color: "#888", fontWeight: 700 }}>Loading your tasks…</div></Card>;
  if (error) return <Card><div style={{ color: ui.colors.danger, fontWeight: 700 }}>{error}</div></Card>;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, color: ui.colors.text }}>My Assigned Tasks</h3>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: ui.colors.textMuted }}>
            Develop on your branch, start work, and submit via GitHub PR or ZIP.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            ...buttonBase,
            padding: "8px 14px",
            background: "#fff",
            border: `1px solid ${ui.colors.borderStrong}`,
            color: ui.colors.text,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {tasks.length === 0 ? (
        <div style={{ padding: "30px 10px", color: ui.colors.textMuted, textAlign: "center", fontWeight: 700 }}>
          No tasks assigned to you yet for this project.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {tasks.map((t) => {
            const statusColors = STATUS_COLORS[t.status] ?? { bg: "#f3f4f6", fg: "#6b7280" };
            const canSubmit = ["ASSIGNED", "IN_PROGRESS", "NEEDS_CHANGES"].includes(t.status);
            const activeMethod = submitMethod[t.assignmentId] || "github";

            return (
              <div
                key={t.assignmentId}
                style={{
                  border: `1px solid ${ui.colors.border}`,
                  borderRadius: 12,
                  padding: "18px",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: ui.colors.text }}>{t.task.name}</div>
                    <div style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 4, fontFamily: "monospace" }}>
                      ID: {t.task.taskId}
                    </div>
                  </div>

                  <span
                    style={{
                      background: statusColors.bg,
                      color: statusColors.fg,
                      fontWeight: 800,
                      fontSize: 12,
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: `1px solid ${ui.colors.border}`,
                    }}
                  >
                    {t.status}
                  </span>
                </div>

                {t.task.description && (
                  <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: ui.colors.textMuted, marginBottom: 4 }}>Summary</div>
                    <div style={{ fontSize: 13, color: ui.colors.textSoft, lineHeight: 1.5 }}>{t.task.description}</div>
                  </div>
                )}

                {t.githubBranch && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ui.colors.textMuted }}>GitHub Branch:</span>
                    <code style={{ background: "#eff6ff", color: "#1e40af", padding: "3px 8px", borderRadius: 6, fontWeight: 900, fontSize: 12 }}>
                      {t.githubBranch}
                    </code>
                  </div>
                )}

                {t.reviewNotes && (
                  <div style={{ marginTop: 12, background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                    <strong style={{ color: "#92400e" }}>Evaluator feedback:</strong>{" "}
                    <span style={{ color: "#78350f" }}>{t.reviewNotes}</span>
                  </div>
                )}

                <div style={{ marginTop: 18, borderTop: `1px solid ${ui.colors.border}`, paddingTop: 16 }}>
                  {t.status === "ASSIGNED" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <p style={{ margin: 0, fontSize: 13, color: ui.colors.textMuted }}>
                        Ready to start? Click "Start Task" to mark it as in progress.
                      </p>
                      <button
                        onClick={() => handleStartTask(t.assignmentId)}
                        disabled={actionLoading[t.assignmentId]}
                        style={{
                          ...buttonBase,
                          alignSelf: "flex-start",
                          padding: "10px 20px",
                          background: "#6366f1",
                          color: "#fff",
                          fontWeight: 800,
                        }}
                      >
                        {actionLoading[t.assignmentId] ? "Starting..." : " Start Task"}
                      </button>
                    </div>
                  ) : canSubmit ? (
                    <div>
                      {/* Submit method toggle tabs */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        <button
                          onClick={() => setSubmitMethod((prev) => ({ ...prev, [t.assignmentId]: "github" }))}
                          style={{
                            ...buttonBase,
                            padding: "8px 14px",
                            background: activeMethod === "github" ? ui.colors.primary : "#f1f5f9",
                            color: activeMethod === "github" ? "#fff" : ui.colors.text,
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          🔗 Submit via GitHub PR
                        </button>
                        <button
                          onClick={() => setSubmitMethod((prev) => ({ ...prev, [t.assignmentId]: "zip" }))}
                          style={{
                            ...buttonBase,
                            padding: "8px 14px",
                            background: activeMethod === "zip" ? ui.colors.primary : "#f1f5f9",
                            color: activeMethod === "zip" ? "#fff" : ui.colors.text,
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          📦 Submit via ZIP File
                        </button>
                      </div>

                      {activeMethod === "github" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 600 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: ui.colors.textMuted }}>
                              PR Number
                            </label>
                            <input
                              type="number"
                              placeholder="e.g. 23"
                              value={prNumber[t.assignmentId] || ""}
                              onChange={(e) => setPrNumber((prev) => ({ ...prev, [t.assignmentId]: e.target.value }))}
                              style={{ ...inputBase, width: "100%", padding: "8px 12px", maxWidth: 200 }}
                            />
                            <small style={{ color: ui.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                              🔗 The system will automatically generate your GitHub Pull Request link.
                            </small>
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: ui.colors.textMuted }}>
                              Submission Note
                            </label>
                            <textarea
                              rows={3}
                              placeholder="Describe your implementation details here..."
                              value={subNote[t.assignmentId] || ""}
                              onChange={(e) => setSubNote((prev) => ({ ...prev, [t.assignmentId]: e.target.value }))}
                              style={{ ...inputBase, width: "100%", padding: "8px 12px", resize: "vertical", minHeight: 60 }}
                            />
                          </div>

                          <button
                            onClick={() => handleGitHubSubmit(t.assignmentId)}
                            disabled={actionLoading[t.assignmentId]}
                            style={{
                              ...buttonBase,
                              alignSelf: "flex-start",
                              padding: "10px 18px",
                              background: ui.colors.primary,
                              color: "#fff",
                              fontWeight: 800,
                            }}
                          >
                            {actionLoading[t.assignmentId] ? "Submitting..." : "Submit via PR"}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="file"
                            accept=".zip"
                            ref={(el) => { fileRefs.current[t.assignmentId] = el; }}
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleZipSubmit(t.assignmentId, f);
                            }}
                          />
                          <button
                            onClick={() => fileRefs.current[t.assignmentId]?.click()}
                            disabled={actionLoading[t.assignmentId]}
                            style={{
                              ...buttonBase,
                              padding: "8px 18px",
                              background: ui.colors.primary,
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {actionLoading[t.assignmentId] ? "Uploading…" : "Upload ZIP File"}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: ui.colors.textMuted, fontSize: 13 }}>
                      {t.status === "SUBMITTED" || t.status === "UNDER_REVIEW" ? (
                        <span>✓ Submitted! Waiting for evaluator review.</span>
                      ) : t.status === "ACCEPTED" || t.status === "MERGED" ? (
                        <span style={{ color: ui.colors.success, fontWeight: 700 }}>✓ Your submission was accepted and merged!</span>
                      ) : (
                        <span>Submission closed (Status: {t.status}).</span>
                      )}
                    </div>
                  )}

                  {actionMsg[t.assignmentId] && (
                    <div
                      style={{
                        marginTop: 12,
                        fontSize: 13,
                        fontWeight: 700,
                        color: actionMsg[t.assignmentId].startsWith("Error") ? ui.colors.danger : ui.colors.success,
                      }}
                    >
                      {actionMsg[t.assignmentId]}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}