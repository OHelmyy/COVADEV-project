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

export default function TaskManagementTab({ projectId, isAdmin }: Props) {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorModal, setErrorModal] = useState<ErrorState>(EMPTY_ERROR);

  // Top-level assignment form state
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedDevId, setSelectedDevId] = useState("");
  const [createBranch, setCreateBranch] = useState(true);
  const [assigning, setAssigning] = useState(false);

  function slugify(text: string) {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-')
      .trim();
  }

  const selectedTask = taskAssignments.find(item => String(item.task.id) === selectedTaskId)?.task;
  const selectedDev = developers.find(dev => String(dev.membershipId) === selectedDevId);

  const branchPreview = selectedTask && selectedDev
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
        const next = prev.map((item) => {
          if (item.task.id === newAssignment.task.id) {
            return { ...item, assignment: newAssignment };
          }
          return item;
        });
        return next;
      });
    } else {
      try {
        const taskData = await getProjectTaskAssignments(projectId);
        setTaskAssignments(taskData.items || []);
      } catch (err: any) {
        openTaskError("refresh task assignments", err, "Task assignments refresh failed");
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
        createBranch: createBranch,
      });
      // reset form
      setSelectedTaskId("");
      setSelectedDevId("");
      // refresh assignments list
      await loadAll();
    } catch (err: any) {
      openTaskError("assign task", err, "Task assignment failed");
    } finally {
      setAssigning(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            Assign extracted BPMN tasks to project developers and review submitted work.
          </div>
        </div>

        {(() => {
          const unassignedCount = taskAssignments.filter((item) => item.assignment === null).length;
          const assignedCount = taskAssignments.filter((item) => item.assignment !== null && !["ACCEPTED", "MERGED"].includes(item.assignment.status)).length;
          const finishedCount = taskAssignments.filter((item) => item.assignment !== null && ["ACCEPTED", "MERGED"].includes(item.assignment.status)).length;

          return (
            <div style={{ ...cardBase, padding: 16 }}>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <div
                  style={{
                    padding: 14,
                    borderRadius: ui.radius.lg,
                    background: ui.colors.bgSoft,
                    border: `1px solid ${ui.colors.border}`,
                    minWidth: 150,
                    flex: "1 1 0px",
                  }}
                >
                  <div style={{ fontSize: 13, color: ui.colors.textMuted, fontWeight: 700 }}>Developers</div>
                  <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24, color: ui.colors.text }}>{developers.length}</div>
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: ui.radius.lg,
                    background: ui.colors.bgSoft,
                    border: `1px solid ${ui.colors.border}`,
                    minWidth: 150,
                    flex: "1 1 0px",
                  }}
                >
                  <div style={{ fontSize: 13, color: ui.colors.textMuted, fontWeight: 700 }}>Total BPMN Tasks</div>
                  <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24, color: ui.colors.text }}>{taskAssignments.length}</div>
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: ui.radius.lg,
                    background: "#fff5f5",
                    border: "1px solid #fee2e2",
                    minWidth: 150,
                    flex: "1 1 0px",
                  }}
                >
                  <div style={{ fontSize: 13, color: "#c53030", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#e53e3e" }}></span>
                    Unassigned Tasks
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24, color: "#c53030" }}>{unassignedCount}</div>
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: ui.radius.lg,
                    background: "#eff6ff",
                    border: "1px solid #dbeafe",
                    minWidth: 150,
                    flex: "1 1 0px",
                  }}
                >
                  <div style={{ fontSize: 13, color: "#1e40af", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }}></span>
                    Assigned Tasks
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24, color: "#1e40af" }}>{assignedCount}</div>
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: ui.radius.lg,
                    background: "#f0fdf4",
                    border: "1px solid #dcfce7",
                    minWidth: 150,
                    flex: "1 1 0px",
                  }}
                >
                  <div style={{ fontSize: 13, color: "#166534", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }}></span>
                    Finished Tasks
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24, color: "#166534" }}>{finishedCount}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Premium Assign Task Card */}
        {!isAdmin && (
        <div style={{ ...cardBase, padding: 24, border: `2px solid ${ui.colors.primarySoft}`, boxShadow: ui.shadow.md }}>
          <h4 style={{ margin: "0 0 20px 0", fontSize: 19, fontWeight: 800, color: ui.colors.primary, display: "flex", alignItems: "center", gap: 8 }}>
            Create Task Assignment
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {/* Task Dropdown */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 800, marginBottom: 8, color: ui.colors.textSoft }}>
                Select BPMN Task <span style={{ color: ui.colors.danger }}>*</span>
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
                  borderColor: selectedTaskId ? ui.colors.primary : ui.colors.borderStrong,
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
                  cursor: "pointer",
                  transition: ui.transition,
                }}
              >
                <option value="">-- Choose an Available BPMN Task --</option>
                {taskAssignments.map((item) => {
                  const isAssigned = !!item.assignment;
                  return (
                    <option key={item.task.id} value={item.task.id} disabled={isAssigned} style={{ padding: 6 }}>
                      {isAssigned ? "🔒 [Assigned] " : "🟢 [Available] "}
                      {item.task.name} {isAssigned ? `(${item.assignment?.status})` : ""}
                    </option>
                  );
                })}
              </select>
              <div style={{ marginTop: 6, fontSize: 12, color: ui.colors.textMuted }}>
                Only unassigned tasks can be assigned to developers.
              </div>
            </div>

            {/* Developer Dropdown */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 800, marginBottom: 8, color: ui.colors.textSoft }}>
                Select Developer <span style={{ color: ui.colors.danger }}>*</span>
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
                  borderColor: selectedDevId ? ui.colors.primary : ui.colors.borderStrong,
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
                  cursor: "pointer",
                  transition: ui.transition,
                }}
              >
                <option value="">-- Choose a Developer --</option>
                {developers.map((dev) => (
                  <option key={dev.membershipId} value={dev.membershipId} style={{ padding: 6 }}>
                    {dev.username} {dev.isAiAgent ? "🤖 (AI Agent)" : "👨‍💻 (Developer)"}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 6, fontSize: 12, color: ui.colors.textMuted }}>
                AI Agents are eligible for automatically suitable tasks.
              </div>
            </div>
          </div>

          {branchPreview && (
            <div style={{
              marginTop: 20,
              padding: "12px 16px",
              background: ui.colors.primarySoft,
              border: `1px solid rgba(15, 61, 145, 0.15)`,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              transition: ui.transition
            }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: ui.colors.primary }}> Target Git Branch:</span>
              <code style={{ fontSize: 14, fontWeight: 900, color: ui.colors.primary, background: "#fff", padding: "4px 8px", borderRadius: 6, border: `1px dashed ${ui.colors.primary}` }}>
                {branchPreview}
              </code>
            </div>
          )}

          {/* Under Section: Checkbox & Submit Button */}
          <div style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: `1px solid ${ui.colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                id="createBranchCheckbox"
                type="checkbox"
                checked={createBranch}
                onChange={(e) => setCreateBranch(e.target.checked)}
                style={{ width: 20, height: 20, cursor: "pointer", accentColor: ui.colors.primary }}
              />
              <label htmlFor="createBranchCheckbox" style={{ fontSize: 14, fontWeight: 700, color: ui.colors.text, cursor: "pointer", userSelect: "none" }}>
                Auto-create GitHub branch on assignment
              </label>
            </div>

            <div>
              <button
                onClick={handleCreateAssignment}
                disabled={assigning || !selectedTaskId || !selectedDevId}
                style={{
                  ...buttonBase,
                  padding: "14px 32px",
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: "0.5px",
                  background: (!selectedTaskId || !selectedDevId)
                    ? "#e2e8f0"
                    : "linear-gradient(135deg, #0f3d91 0%, #1e40af 100%)",
                  color: (!selectedTaskId || !selectedDevId) ? "#94a3b8" : "#ffffff",
                  border: "none",
                  boxShadow: (!selectedTaskId || !selectedDevId) ? "none" : "0 4px 12px rgba(15, 61, 145, 0.25)",
                  cursor: (assigning || !selectedTaskId || !selectedDevId) ? "not-allowed" : "pointer",
                  transition: ui.transition,
                }}
              >
                {assigning ? "Assigning..." : " Assign BPMN Task"}
              </button>
            </div>
          </div>
        </div>
        )}

        <div style={{ ...cardBase, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: ui.colors.bgSoft }}>
                  <th style={{ textAlign: "left", padding: 14 }}>BPMN Task</th>
                  <th style={{ textAlign: "left", padding: 14 }}>Assigned Developer</th>
                  <th style={{ textAlign: "left", padding: 14 }}>GitHub Branch</th>
                  <th style={{ textAlign: "left", padding: 14 }}>PR Link</th>
                  <th style={{ textAlign: "left", padding: 14 }}>Status</th>
                  <th style={{ textAlign: "left", padding: 14 }}>Assigned Date</th>
                  <th style={{ textAlign: "left", padding: 14 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {taskAssignments.filter((item) => item.assignment !== null).length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, color: ui.colors.textMuted, textAlign: "center", fontSize: 15 }}>
                      No active task assignments yet. Use the card above to assign a BPMN task!
                    </td>
                  </tr>
                ) : (
                  taskAssignments
                    .filter((item) => item.assignment !== null)
                    .map((item) => (
                      <TaskAssignmentRow
                        key={`${item.task.id}-${item.assignment?.assignmentId || "unassigned"}-${item.assignment?.evaluation?.id || "no-eval"
                          }-${item.assignment?.evaluation?.finalScore || "0"}`}
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