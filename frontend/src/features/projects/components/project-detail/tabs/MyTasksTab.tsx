import { useEffect, useRef, useState } from "react";
import { submitZip } from "../../../../../api/projects";
import {
  getMyTaskAssignments,
  startTaskAssignment,
  submitTaskAssignment,
} from "../../../../task-management/api/taskManagementApi";
import type {
  AssignmentWithTask,
  TimeTrackingStatus,
} from "../../../../task-management/types";
import { Card } from "../ProjectUi";
import { buttonBase, inputBase, ui } from "../../../../../theme/ui";

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

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getLiveElapsedLabel(startedAt?: string | null) {
  if (!startedAt) return "Not started yet";

  const start = new Date(startedAt);
  const now = new Date();

  if (Number.isNaN(start.getTime())) return "—";

  const diffMs = now.getTime() - start.getTime();

  if (diffMs < 0) return "—";

  const totalMinutes = Math.floor(diffMs / 60000);

  if (totalMinutes < 1) return "Less than 1 min";

  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) return `${hours}h`;

  return `${hours}h ${minutes}m`;
}
function getTimeTrackingTone(status?: TimeTrackingStatus | null) {
  switch (status) {
    case "COMPLETED_EARLY":
      return {
        bg: "#ecfdf5",
        fg: "#047857",
        border: "#a7f3d0",
        label: "Finished early",
      };

    case "ON_TIME":
      return {
        bg: "#eff6ff",
        fg: "#1d4ed8",
        border: "#bfdbfe",
        label: "On time",
      };

    case "SLIGHTLY_OVER":
      return {
        bg: "#fffbeb",
        fg: "#b45309",
        border: "#fde68a",
        label: "Slightly over",
      };

    case "OVER_ESTIMATE":
      return {
        bg: "#fef2f2",
        fg: "#b91c1c",
        border: "#fecaca",
        label: "Over estimate",
      };

    case "IN_PROGRESS":
      return {
        bg: "#f5f3ff",
        fg: "#6d28d9",
        border: "#ddd6fe",
        label: "In progress",
      };

    case "NOT_STARTED":
      return {
        bg: "#f8fafc",
        fg: "#475569",
        border: "#e2e8f0",
        label: "Not started",
      };

    case "NO_ACTUAL_TIME":
      return {
        bg: "#f8fafc",
        fg: "#475569",
        border: "#e2e8f0",
        label: "No actual time",
      };

    case "NO_ESTIMATE":
    default:
      return {
        bg: "#f3f4f6",
        fg: "#4b5563",
        border: "#e5e7eb",
        label: "No estimate",
      };
  }
}

export default function MyTasksTab({ projectId }: Props) {
  const [tasks, setTasks] = useState<AssignmentWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [submitMethod, setSubmitMethod] = useState<
    Record<number, "github" | "zip">
  >({});
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
      const filtered = (res.items || []).filter(
        (item) => item.projectId === projectId
      );

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

      setActionMsg((prev) => ({
        ...prev,
        [assignmentId]: "✓ Task started successfully!",
      }));

      await load();
    } catch (e: any) {
      setActionMsg((prev) => ({
        ...prev,
        [assignmentId]: `Error: ${e.message}`,
      }));
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
        githubPrUrl: "",
        submissionNotes: note,
      });

      setActionMsg((prev) => ({
        ...prev,
        [assignmentId]: "✓ Task submitted successfully!",
      }));

      setPrNumber((prev) => ({ ...prev, [assignmentId]: "" }));
      setSubNote((prev) => ({ ...prev, [assignmentId]: "" }));

      await load();
    } catch (e: any) {
      setActionMsg((prev) => ({
        ...prev,
        [assignmentId]: `Error: ${e.message}`,
      }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [assignmentId]: false }));
    }
  }

  async function handleZipSubmit(assignmentId: number, file: File) {
    setActionLoading((prev) => ({ ...prev, [assignmentId]: true }));
    setActionMsg((prev) => ({ ...prev, [assignmentId]: "" }));

    try {
      await submitZip(projectId, assignmentId, file);

      setActionMsg((prev) => ({
        ...prev,
        [assignmentId]: "✓ ZIP submitted successfully!",
      }));

      await load();
    } catch (e: any) {
      setActionMsg((prev) => ({
        ...prev,
        [assignmentId]: `Error: ${e.message}`,
      }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [assignmentId]: false }));

      if (fileRefs.current[assignmentId]) {
        fileRefs.current[assignmentId]!.value = "";
      }
    }
  }

  if (loading) {
    return (
      <Card>
        <div style={{ color: "#888", fontWeight: 700 }}>
          Loading your tasks…
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div style={{ color: ui.colors.danger, fontWeight: 700 }}>{error}</div>
      </Card>
    );
  }

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 20, color: ui.colors.text }}>
            My Assigned Tasks
          </h3>

          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: 13,
              color: ui.colors.textMuted,
            }}
          >
            Develop on your branch, start work, submit via GitHub PR or ZIP,
            and compare your actual time with the BPMN estimate.
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
        <div
          style={{
            padding: "30px 10px",
            color: ui.colors.textMuted,
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          No tasks assigned to you yet for this project.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {tasks.map((t) => {
            const statusColors = STATUS_COLORS[t.status] ?? {
              bg: "#f3f4f6",
              fg: "#6b7280",
            };

            const canSubmit = [
              "ASSIGNED",
              "IN_PROGRESS",
              "NEEDS_CHANGES",
            ].includes(t.status);

            const activeMethod = submitMethod[t.assignmentId] || "github";
            const timeTone = getTimeTrackingTone(t.timeTracking?.status);

            return (
              <div
                key={t.assignmentId}
                style={{
                  border: `1px solid ${ui.colors.border}`,
                  borderRadius: 16,
                  padding: 18,
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 17,
                        color: ui.colors.text,
                      }}
                    >
                      {t.task.name}
                    </div>

                    <div
                      style={{
                        color: ui.colors.textMuted,
                        fontSize: 12,
                        marginTop: 4,
                        fontFamily: "monospace",
                      }}
                    >
                      ID: {t.task.taskId}
                    </div>
                  </div>

                  <span
                    style={{
                      background: statusColors.bg,
                      color: statusColors.fg,
                      fontWeight: 900,
                      fontSize: 12,
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: `1px solid ${ui.colors.border}`,
                    }}
                  >
                    {t.status.replaceAll("_", " ")}
                  </span>
                </div>

                {t.task.description && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      background: "#f8fafc",
                      borderRadius: 10,
                      border: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: ui.colors.textMuted,
                        marginBottom: 4,
                      }}
                    >
                      Summary
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: ui.colors.textSoft,
                        lineHeight: 1.5,
                      }}
                    >
                      {t.task.description}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid #e5e7eb",
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        fontWeight: 800,
                      }}
                    >
                      Estimated Time
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 18,
                        fontWeight: 950,
                        color: "#0f172a",
                      }}
                    >
                      {t.timeTracking?.estimatedLabel ||
                        t.task.estimatedDurationLabel ||
                        "—"}
                    </div>

                    {t.timeTracking?.estimatedSource ||
                    t.task.estimatedDurationSource ? (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: "#94a3b8",
                          fontWeight: 700,
                        }}
                      >
                        Source:{" "}
                        {t.timeTracking?.estimatedSource ||
                          t.task.estimatedDurationSource}
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid #e5e7eb",
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        fontWeight: 800,
                      }}
                    >
                      Real Work Time
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 18,
                        fontWeight: 950,
                        color: "#0f172a",
                      }}
                    >
                      {t.timeTracking?.actualLabel ||
                        (t.timeTracking?.startedAt
                          ? getLiveElapsedLabel(t.timeTracking.startedAt)
                          : "Not started yet")}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        display: "grid",
                        gap: 3,
                        fontSize: 11,
                        color: "#64748b",
                        fontWeight: 700,
                        lineHeight: 1.4,
                      }}
                    >
                      <div>
                        Started:{" "}
                        <span style={{ color: "#334155" }}>
                          {formatDateTime(t.timeTracking?.startedAt)}
                        </span>
                      </div>

                      <div>
                        Submitted:{" "}
                        <span style={{ color: "#334155" }}>
                          {formatDateTime(t.timeTracking?.submittedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${timeTone.border}`,
                      background: timeTone.bg,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: timeTone.fg,
                        fontWeight: 800,
                      }}
                    >
                      Time Result
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 14,
                        fontWeight: 950,
                        color: timeTone.fg,
                        lineHeight: 1.4,
                      }}
                    >
                      {t.timeTracking?.differenceLabel || timeTone.label}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: timeTone.fg,
                        opacity: 0.8,
                        fontWeight: 700,
                      }}
                    >
                      {timeTone.label}
                    </div>
                  </div>
                </div>

                {(t.timeTracking?.estimatedReason ||
                  t.task.estimatedDurationReason) && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "#f8fafc",
                      border: "1px dashed #cbd5e1",
                      color: "#64748b",
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: "#475569" }}>
                      Estimation reason:
                    </strong>{" "}
                    {t.timeTracking?.estimatedReason ||
                      t.task.estimatedDurationReason}
                  </div>
                )}

                {t.githubBranch && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: ui.colors.textMuted,
                      }}
                    >
                      GitHub Branch:
                    </span>

                    <code
                      style={{
                        background: "#eff6ff",
                        color: "#1e40af",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontWeight: 900,
                        fontSize: 12,
                      }}
                    >
                      {t.githubBranch}
                    </code>
                  </div>
                )}

                {t.reviewNotes && (
                  <div
                    style={{
                      marginTop: 12,
                      background: "#fffbeb",
                      border: "1px solid #fef3c7",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                    }}
                  >
                    <strong style={{ color: "#92400e" }}>
                      Evaluator feedback:
                    </strong>{" "}
                    <span style={{ color: "#78350f" }}>{t.reviewNotes}</span>
                  </div>
                )}

                <div
                  style={{
                    marginTop: 18,
                    borderTop: `1px solid ${ui.colors.border}`,
                    paddingTop: 16,
                  }}
                >
                  {t.status === "ASSIGNED" ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: ui.colors.textMuted,
                        }}
                      >
                        Ready to start? Click "Start Task" to mark it as in
                        progress and begin tracking your actual completion time.
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
                        {actionLoading[t.assignmentId]
                          ? "Starting..."
                          : "Start Task"}
                      </button>
                    </div>
                  ) : canSubmit ? (
                    <div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        <button
                          onClick={() =>
                            setSubmitMethod((prev) => ({
                              ...prev,
                              [t.assignmentId]: "github",
                            }))
                          }
                          style={{
                            ...buttonBase,
                            padding: "8px 14px",
                            background:
                              activeMethod === "github"
                                ? ui.colors.primary
                                : "#f1f5f9",
                            color:
                              activeMethod === "github"
                                ? "#fff"
                                : ui.colors.text,
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          🔗 Submit via GitHub PR
                        </button>

                        <button
                          onClick={() =>
                            setSubmitMethod((prev) => ({
                              ...prev,
                              [t.assignmentId]: "zip",
                            }))
                          }
                          style={{
                            ...buttonBase,
                            padding: "8px 14px",
                            background:
                              activeMethod === "zip"
                                ? ui.colors.primary
                                : "#f1f5f9",
                            color:
                              activeMethod === "zip"
                                ? "#fff"
                                : ui.colors.text,
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          📦 Submit via ZIP File
                        </button>
                      </div>

                      {activeMethod === "github" ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            maxWidth: 600,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 700,
                                marginBottom: 4,
                                color: ui.colors.textMuted,
                              }}
                            >
                              PR Number
                            </label>

                            <input
                              type="number"
                              placeholder="e.g. 23"
                              value={prNumber[t.assignmentId] || ""}
                              onChange={(e) =>
                                setPrNumber((prev) => ({
                                  ...prev,
                                  [t.assignmentId]: e.target.value,
                                }))
                              }
                              style={{
                                ...inputBase,
                                width: "100%",
                                padding: "8px 12px",
                                maxWidth: 200,
                              }}
                            />

                            <small
                              style={{
                                color: ui.colors.textMuted,
                                fontSize: 11,
                                marginTop: 2,
                              }}
                            >
                              🔗 The system will automatically generate your
                              GitHub Pull Request link.
                            </small>
                          </div>

                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 700,
                                marginBottom: 4,
                                color: ui.colors.textMuted,
                              }}
                            >
                              Submission Note
                            </label>

                            <textarea
                              rows={3}
                              placeholder="Describe your implementation details here..."
                              value={subNote[t.assignmentId] || ""}
                              onChange={(e) =>
                                setSubNote((prev) => ({
                                  ...prev,
                                  [t.assignmentId]: e.target.value,
                                }))
                              }
                              style={{
                                ...inputBase,
                                width: "100%",
                                padding: "8px 12px",
                                resize: "vertical",
                                minHeight: 60,
                              }}
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
                            {actionLoading[t.assignmentId]
                              ? "Submitting..."
                              : "Submit via PR"}
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <input
                            type="file"
                            accept=".zip"
                            ref={(el) => {
                              fileRefs.current[t.assignmentId] = el;
                            }}
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];

                              if (f) {
                                handleZipSubmit(t.assignmentId, f);
                              }
                            }}
                          />

                          <button
                            onClick={() =>
                              fileRefs.current[t.assignmentId]?.click()
                            }
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
                            {actionLoading[t.assignmentId]
                              ? "Uploading…"
                              : "Upload ZIP File"}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: ui.colors.textMuted, fontSize: 13 }}>
                      {t.status === "SUBMITTED" ||
                      t.status === "UNDER_REVIEW" ? (
                        <span>✓ Submitted! Waiting for evaluator review.</span>
                      ) : t.status === "ACCEPTED" || t.status === "MERGED" ? (
                        <span
                          style={{
                            color: ui.colors.success,
                            fontWeight: 700,
                          }}
                        >
                          ✓ Your submission was accepted and merged!
                        </span>
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
                        color: actionMsg[t.assignmentId].startsWith("Error")
                          ? ui.colors.danger
                          : ui.colors.success,
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