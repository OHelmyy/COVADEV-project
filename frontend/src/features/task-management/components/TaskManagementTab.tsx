import { useEffect, useState } from "react";
import TaskAssignmentRow from "./TaskAssignmentRow";
import {
  getProjectDevelopers,
  getProjectTaskAssignments,
  assignTask,
} from "../api/taskManagementApi";
import type { Developer, TaskAssignmentItem } from "../types";
import { cardBase, ui, buttonBase, inputBase } from "../../../theme/ui";
import ErrorModal from "../../../components/ErrorModal";
import { buildTaskManagementError } from "../utils/taskManagementError";

type Props = {
  projectId: number;
  isAdmin?: boolean;
};

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

function formatMinutes(minutes?: number | null) {
  if (minutes === null || minutes === undefined) return "—";

  const totalMinutes = Math.round(minutes);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const workingDayMinutes = 8 * 60;

  if (totalMinutes >= workingDayMinutes) {
    const days = Math.floor(totalMinutes / workingDayMinutes);
    const remainingAfterDays = totalMinutes % workingDayMinutes;

    const hours = Math.floor(remainingAfterDays / 60);
    const mins = remainingAfterDays % 60;

    const dayLabel = days === 1 ? "1 day" : `${days} days`;

    if (hours === 0 && mins === 0) {
      return dayLabel;
    }

    if (mins === 0) {
      return `${dayLabel} ${hours}h`;
    }

    return `${dayLabel} ${hours}h ${mins}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}
function getTaskStatusBadge(item: TaskAssignmentItem) {
  if (!item.assignment) {
    return {
      label: "Available",
      bg: "#f0fdf4",
      color: "#166534",
      border: "#bbf7d0",
      dot: "#22c55e",
    };
  }

  if (["ACCEPTED", "MERGED"].includes(item.assignment.status)) {
    return {
      label: "Finished",
      bg: "#ecfdf5",
      color: "#047857",
      border: "#a7f3d0",
      dot: "#10b981",
    };
  }

  return {
    label: item.assignment.status.replaceAll("_", " "),
    bg: "#eff6ff",
    color: "#1d4ed8",
    border: "#bfdbfe",
    dot: "#3b82f6",
  };
}

function MetricCard({
  label,
  value,
  hint,
  bg,
  color,
  border,
  dot,
}: {
  label: string;
  value: string | number;
  hint?: string;
  bg: string;
  color: string;
  border: string;
  dot?: string;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: ui.radius.lg,
        background: bg,
        border: `1px solid ${border}`,
        minWidth: 150,
        flex: "1 1 0px",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {dot ? (
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: dot,
            }}
          />
        ) : null}
        {label}
      </div>

      <div
        style={{
          marginTop: 6,
          fontWeight: 900,
          fontSize: 24,
          color,
        }}
      >
        {value}
      </div>

      {hint ? (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color,
            opacity: 0.78,
            fontWeight: 600,
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export default function TaskManagementTab({ projectId, isAdmin }: Props) {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorModal, setErrorModal] = useState<ErrorState>(EMPTY_ERROR);

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedDevId, setSelectedDevId] = useState("");
  const [createBranch, setCreateBranch] = useState(true);
  const [assigning, setAssigning] = useState(false);

  function slugify(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s-]+/g, "-")
      .trim();
  }

  const selectedTask = taskAssignments.find(
    (item) => String(item.task.id) === selectedTaskId
  )?.task;

  const selectedDev = developers.find(
    (dev) => String(dev.membershipId) === selectedDevId
  );

  const branchPreview =
    selectedTask && selectedDev
      ? `task/${slugify(selectedTask.name)}-${slugify(selectedDev.username)}`
      : "";

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

  async function handleAssignmentChanged(_assignmentId?: number, newAssignment?: any) {
    if (newAssignment && newAssignment.task?.id) {
      setTaskAssignments((prev) => {
        return prev.map((item) => {
          if (item.task.id === newAssignment.task.id) {
            return { ...item, assignment: newAssignment };
          }
          return item;
        });
      });
    } else {
      try {
        const taskData = await getProjectTaskAssignments(projectId);
        setTaskAssignments(taskData.items || []);
      } catch (err: any) {
        openTaskError(
          "refresh task assignments",
          err,
          "Task assignments refresh failed"
        );
      }
    }
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
      const message = err.message || "Something went wrong";
      setError(message);
      openTaskError("load task management", err, "Task management load failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAssignment() {
    if (!selectedTaskId || !selectedDevId) {
      alert("Please select both a task and a developer.");
      return;
    }

    if (
      selectedDev?.isAiAgent &&
      selectedTask?.aiSuitability === "NOT_RECOMMENDED"
    ) {
      const reasonText = selectedTask.aiSuitabilityReason
        ? `\n\nReason: ${selectedTask.aiSuitabilityReason}`
        : "";

      const ok = window.confirm(
        `This task is marked NOT RECOMMENDED for the AI agent.${reasonText}\n\nAssign anyway?`
      );

      if (!ok) return;
    }

    setAssigning(true);

    try {
      await assignTask(projectId, {
        bpmnTaskId: Number(selectedTaskId),
        developerMembershipId: Number(selectedDevId),
        notes: "",
        createBranch,
      });

      setSelectedTaskId("");
      setSelectedDevId("");

      await loadAll();
    } catch (err: any) {
      openTaskError("assign task", err, "Task assignment failed");
    } finally {
      setAssigning(false);
    }
  }

  useEffect(() => {
    if (projectId) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const unassignedCount = taskAssignments.filter(
    (item) => item.assignment === null
  ).length;

  const assignedCount = taskAssignments.filter(
    (item) =>
      item.assignment !== null &&
      !["ACCEPTED", "MERGED"].includes(item.assignment.status)
  ).length;

  const finishedCount = taskAssignments.filter(
    (item) =>
      item.assignment !== null &&
      ["ACCEPTED", "MERGED"].includes(item.assignment.status)
  ).length;

  const estimatedTotalMinutes = taskAssignments.reduce((sum, item) => {
    return sum + Number(item.task.estimatedDurationMinutes || 0);
  }, 0);

  const finishedActualMinutes = taskAssignments.reduce((sum, item) => {
    return sum + Number(item.assignment?.timeTracking?.actualMinutes || 0);
  }, 0);

  const availableTasks = taskAssignments.filter((item) => !item.assignment);

  if (loading) {
    return (
      <div style={{ ...cardBase, padding: 18 }}>
        <div style={{ fontWeight: 900 }}>Loading task management...</div>
      </div>
    );
  }

  if (error && taskAssignments.length === 0 && developers.length === 0) {
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
            background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
            color: "#fff",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 22 }}>Task Management</h3>
          <div style={{ marginTop: 8, opacity: 0.95, lineHeight: 1.6 }}>
            Assign extracted BPMN tasks to project developers, review submitted work,
            and compare estimated effort with actual completion time.
          </div>
        </div>

        <div style={{ ...cardBase, padding: 16 }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <MetricCard
              label="Developers"
              value={developers.length}
              bg={ui.colors.bgSoft}
              color={ui.colors.text}
              border={ui.colors.border}
            />

            <MetricCard
              label="Total BPMN Tasks"
              value={taskAssignments.length}
              bg={ui.colors.bgSoft}
              color={ui.colors.text}
              border={ui.colors.border}
            />

            <MetricCard
              label="Unassigned Tasks"
              value={unassignedCount}
              bg="#fff5f5"
              color="#c53030"
              border="#fee2e2"
              dot="#e53e3e"
            />

            <MetricCard
              label="Assigned Tasks"
              value={assignedCount}
              bg="#eff6ff"
              color="#1e40af"
              border="#dbeafe"
              dot="#3b82f6"
            />

            <MetricCard
              label="Finished Tasks"
              value={finishedCount}
              bg="#f0fdf4"
              color="#166534"
              border="#dcfce7"
              dot="#22c55e"
            />

            <MetricCard
              label="Estimated Workload"
              value={formatMinutes(estimatedTotalMinutes)}
              hint="Based on extracted BPMN tasks"
              bg="#f5f3ff"
              color="#6d28d9"
              border="#ddd6fe"
              dot="#8b5cf6"
            />

            <MetricCard
              label="Actual Finished Time"
              value={formatMinutes(finishedActualMinutes)}
              hint="Based on submitted tasks"
              bg="#ecfeff"
              color="#0e7490"
              border="#a5f3fc"
              dot="#06b6d4"
            />
          </div>
        </div>

        {!isAdmin && (
          <div
            style={{
              ...cardBase,
              padding: 24,
              border: `2px solid ${ui.colors.primarySoft}`,
              boxShadow: ui.shadow.md,
            }}
          >
            <h4
              style={{
                margin: "0 0 20px 0",
                fontSize: 19,
                fontWeight: 900,
                color: ui.colors.primary,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Create Task Assignment
            </h4>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 20,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 800,
                    marginBottom: 8,
                    color: ui.colors.textSoft,
                  }}
                >
                  Select BPMN Task{" "}
                  <span style={{ color: ui.colors.danger }}>*</span>
                </label>

                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  style={{
                    ...inputBase,
                    width: "100%",
                    padding: "12px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                    borderColor: selectedTaskId
                      ? ui.colors.primary
                      : ui.colors.borderStrong,
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
                    cursor: "pointer",
                    transition: ui.transition,
                  }}
                >
                  <option value="">-- Choose an Available BPMN Task --</option>

                  {taskAssignments.map((item) => {
                    const isAssigned = !!item.assignment;
                    const estimate =
                      item.task.estimatedDurationLabel ||
                      formatMinutes(item.task.estimatedDurationMinutes);

                    return (
                      <option
                        key={item.task.id}
                        value={item.task.id}
                        disabled={isAssigned}
                        style={{ padding: 6 }}
                      >
                        {isAssigned ? "🔒 [Assigned] " : "🟢 [Available] "}
                        {item.task.name}
                        {" · "}
                        ⏱ {estimate}
                        {isAssigned ? ` (${item.assignment?.status})` : ""}
                      </option>
                    );
                  })}
                </select>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: ui.colors.textMuted,
                  }}
                >
                  Only unassigned tasks can be assigned to developers.
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 800,
                    marginBottom: 8,
                    color: ui.colors.textSoft,
                  }}
                >
                  Select Developer{" "}
                  <span style={{ color: ui.colors.danger }}>*</span>
                </label>

                <select
                  value={selectedDevId}
                  onChange={(e) => setSelectedDevId(e.target.value)}
                  style={{
                    ...inputBase,
                    width: "100%",
                    padding: "12px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                    borderColor: selectedDevId
                      ? ui.colors.primary
                      : ui.colors.borderStrong,
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
                    cursor: "pointer",
                    transition: ui.transition,
                  }}
                >
                  <option value="">-- Choose a Developer --</option>

                  {developers.map((dev) => (
                    <option
                      key={dev.membershipId}
                      value={dev.membershipId}
                      style={{ padding: 6 }}
                    >
                      {dev.username}{" "}
                      {dev.isAiAgent ? "🤖 (AI Agent)" : "👨‍💻 (Developer)"}
                    </option>
                  ))}
                </select>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: ui.colors.textMuted,
                  }}
                >
                  AI Agents are eligible for automatically suitable tasks.
                </div>
              </div>
            </div>

            {selectedTask ? (
              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  borderRadius: 16,
                  background:
                    "linear-gradient(135deg, rgba(239,246,255,0.95) 0%, rgba(236,254,255,0.95) 100%)",
                  border: "1px solid #bfdbfe",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: "#1d4ed8",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Selected BPMN Task
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 17,
                      fontWeight: 900,
                      color: "#0f172a",
                    }}
                  >
                    {selectedTask.name}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: "#475569",
                      lineHeight: 1.55,
                    }}
                  >
                    {selectedTask.description ||
                      selectedTask.summaryText ||
                      "No task description available."}
                  </div>

                  {selectedTask.estimatedDurationReason ? (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      Estimated by{" "}
                      {selectedTask.estimatedDurationSource || "system"} ·{" "}
                      {selectedTask.estimatedDurationReason}
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "#fff",
                    border: "1px solid #bfdbfe",
                    minWidth: 120,
                    textAlign: "center",
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
                      fontSize: 22,
                      color: "#1d4ed8",
                      fontWeight: 950,
                    }}
                  >
                    {selectedTask.estimatedDurationLabel ||
                      formatMinutes(selectedTask.estimatedDurationMinutes)}
                  </div>
                </div>
              </div>
            ) : null}

            {availableTasks.length > 0 ? (
              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {availableTasks.slice(0, 6).map((item) => {
                  const badge = getTaskStatusBadge(item);

                  return (
                    <span
                      key={item.task.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: badge.bg,
                        border: `1px solid ${badge.border}`,
                        color: badge.color,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                      title={item.task.estimatedDurationReason || ""}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: badge.dot,
                        }}
                      />
                      {item.task.name} ·{" "}
                      {item.task.estimatedDurationLabel ||
                        formatMinutes(item.task.estimatedDurationMinutes)}
                    </span>
                  );
                })}

                {availableTasks.length > 6 ? (
                  <span
                    style={{
                      padding: "7px 10px",
                      borderRadius: 999,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#64748b",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    +{availableTasks.length - 6} more available
                  </span>
                ) : null}
              </div>
            ) : null}

            {branchPreview && (
              <div
                style={{
                  marginTop: 20,
                  padding: "12px 16px",
                  background: ui.colors.primarySoft,
                  border: `1px solid rgba(15, 61, 145, 0.15)`,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  transition: ui.transition,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: ui.colors.primary,
                  }}
                >
                  Target Git Branch:
                </span>

                <code
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: ui.colors.primary,
                    background: "#fff",
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: `1px dashed ${ui.colors.primary}`,
                  }}
                >
                  {branchPreview}
                </code>
              </div>
            )}

            <div
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: `1px solid ${ui.colors.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  id="createBranchCheckbox"
                  type="checkbox"
                  checked={createBranch}
                  onChange={(e) => setCreateBranch(e.target.checked)}
                  style={{
                    width: 20,
                    height: 20,
                    cursor: "pointer",
                    accentColor: ui.colors.primary,
                  }}
                />

                <label
                  htmlFor="createBranchCheckbox"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: ui.colors.text,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  Auto-create GitHub branch on assignment
                </label>
              </div>

              <button
                onClick={handleCreateAssignment}
                disabled={assigning || !selectedTaskId || !selectedDevId}
                style={{
                  ...buttonBase,
                  padding: "14px 32px",
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: "0.5px",
                  background:
                    !selectedTaskId || !selectedDevId
                      ? "#e2e8f0"
                      : "linear-gradient(135deg, #0f3d91 0%, #1e40af 100%)",
                  color:
                    !selectedTaskId || !selectedDevId ? "#94a3b8" : "#ffffff",
                  border: "none",
                  boxShadow:
                    !selectedTaskId || !selectedDevId
                      ? "none"
                      : "0 4px 12px rgba(15, 61, 145, 0.25)",
                  cursor:
                    assigning || !selectedTaskId || !selectedDevId
                      ? "not-allowed"
                      : "pointer",
                  transition: ui.transition,
                }}
              >
                {assigning ? "Assigning..." : "Assign BPMN Task"}
              </button>
            </div>
          </div>
        )}

        <div style={{ ...cardBase, overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 18px",
              borderBottom: `1px solid ${ui.colors.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              background:
                "linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(239,246,255,0.75) 100%)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: ui.colors.text,
                }}
              >
                Active Assignment Board
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: ui.colors.textMuted,
                  fontWeight: 600,
                }}
              >
                Track assigned BPMN tasks, branches, pull requests, status, and review actions.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  padding: "7px 10px",
                  borderRadius: 999,
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {assignedCount} active
              </span>

              <span
                style={{
                  padding: "7px 10px",
                  borderRadius: 999,
                  background: "#f0fdf4",
                  color: "#166534",
                  border: "1px solid #bbf7d0",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {finishedCount} finished
              </span>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
              }}
            >
              <thead>
                <tr style={{ background: ui.colors.bgSoft }}>
                  <th style={{ textAlign: "left", padding: 14 }}>BPMN Task</th>
                  <th style={{ textAlign: "left", padding: 14 }}>
                    Assigned Developer
                  </th>
                  <th style={{ textAlign: "left", padding: 14 }}>
                    GitHub Branch
                  </th>
                  <th style={{ textAlign: "left", padding: 14 }}>PR Link</th>
                  <th style={{ textAlign: "left", padding: 14 }}>Status</th>
                  <th style={{ textAlign: "left", padding: 14 }}>
                    Assigned Date
                  </th>
                  <th style={{ textAlign: "left", padding: 14 }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {taskAssignments.filter((item) => item.assignment !== null)
                  .length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: 28,
                        color: ui.colors.textMuted,
                        textAlign: "center",
                        fontSize: 15,
                      }}
                    >
                      No active task assignments yet. Use the card above to assign
                      a BPMN task.
                    </td>
                  </tr>
                ) : (
                  taskAssignments
                    .filter((item) => item.assignment !== null)
                    .map((item) => (
                      <TaskAssignmentRow
                        key={`${item.task.id}-${
                          item.assignment?.assignmentId || "unassigned"
                        }-${item.assignment?.evaluation?.id || "no-eval"}-${
                          item.assignment?.evaluation?.finalScore || "0"
                        }`}
                        projectId={projectId}
                        task={item.task}
                        assignment={item.assignment}
                        developers={developers}
                        onChanged={handleAssignmentChanged}
                        onError={openTaskError}
                      />
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