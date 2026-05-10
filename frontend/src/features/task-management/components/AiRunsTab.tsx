import { useEffect, useState } from "react";
import { getProjectAiRuns } from "../api/taskManagementApi";
import type { AiRunsResponse, AiRunItem } from "../types";
import AiSubmissionViewer from "./AiSubmissionViewer";
import { ui, cardBase, buttonBase } from "../../../theme/ui";

type Props = {
  projectId: number;
};

function StatusPill({ status }: { status: string }) {
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
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.color,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        padding: 14,
        borderRadius: ui.radius.lg,
        background: ui.colors.bgSoft,
        border: `1px solid ${ui.colors.border}`,
      }}
    >
      <div style={{ fontSize: 12, color: ui.colors.textMuted }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          fontWeight: 900,
          fontSize: 24,
          color: color || ui.colors.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function AiRunsTab({ projectId }: Props) {
  const [data, setData] = useState<AiRunsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openAssignmentId, setOpenAssignmentId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await getProjectAiRuns(projectId);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load AI runs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) load();
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ ...cardBase, padding: 18 }}>
        <div style={{ fontWeight: 900 }}>Loading AI runs...</div>
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
          color: ui.colors.danger,
          fontWeight: 700,
        }}
      >
        {error}
      </div>
    );
  }

  if (!data || data.totalRuns === 0) {
    return (
      <div style={{ ...cardBase, padding: 18, color: ui.colors.textMuted }}>
        No AI runs in this project yet. Assign a task to the AI agent to get started.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div
        style={{
          ...cardBase,
          padding: 18,
          background: "linear-gradient(135deg, #312e81 0%, #6366f1 100%)",
          color: "#fff",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 22 }}>AI Runs</h3>
        <div style={{ marginTop: 8, opacity: 0.95 }}>
          Every Python submission produced by the AI agent for this project.
        </div>
      </div>

      {/* Stats */}
      <div style={{ ...cardBase, padding: 16 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <StatCard label="Total runs" value={data.totalRuns} />
          <StatCard label="Submitted (awaiting review)" value={data.totals.submitted} color={ui.colors.warning} />
          <StatCard label="Accepted" value={data.totals.accepted} color={ui.colors.success} />
          <StatCard label="Rejected" value={data.totals.rejected} color={ui.colors.danger} />
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            onClick={load}
            disabled={loading}
            style={{
              ...buttonBase,
              padding: "6px 12px",
              border: `1px solid ${ui.colors.borderStrong}`,
              background: "#fff",
              color: ui.colors.text,
              fontSize: 12,
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Runs table */}
      <div style={{ ...cardBase, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: ui.colors.bgSoft }}>
                <th style={{ textAlign: "left", padding: 12, fontSize: 12 }}>Task</th>
                <th style={{ textAlign: "left", padding: 12, fontSize: 12 }}>Attempt</th>
                <th style={{ textAlign: "left", padding: 12, fontSize: 12 }}>Status</th>
                <th style={{ textAlign: "left", padding: 12, fontSize: 12 }}>Model</th>
                <th style={{ textAlign: "left", padding: 12, fontSize: 12 }}>Tokens</th>
                <th style={{ textAlign: "left", padding: 12, fontSize: 12 }}>Files</th>
                <th style={{ textAlign: "left", padding: 12, fontSize: 12 }}>Created</th>
                <th style={{ textAlign: "left", padding: 12, fontSize: 12 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row: AiRunItem) => {
                const isOpen = openAssignmentId === row.assignmentId;
                return (
                  <>
                    <tr key={row.submissionId}>
                      <td style={{ padding: 12, borderBottom: `1px solid ${ui.colors.border}` }}>
                        <div style={{ fontWeight: 700 }}>{row.taskName}</div>
                        <div style={{ fontSize: 11, color: ui.colors.textMuted }}>
                          Task #{row.taskId} · Assignment #{row.assignmentId}
                        </div>
                      </td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${ui.colors.border}`, fontWeight: 700 }}>
                        #{row.attemptNumber}
                      </td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${ui.colors.border}` }}>
                        <StatusPill status={row.taskStatus} />
                      </td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${ui.colors.border}`, fontSize: 12 }}>
                        {row.modelUsed || "—"}
                      </td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {row.tokensUsed}
                      </td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {row.fileCount}
                      </td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${ui.colors.border}`, fontSize: 12 }}>
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                      </td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${ui.colors.border}` }}>
                        <button
                          onClick={() =>
                            setOpenAssignmentId(isOpen ? null : row.assignmentId)
                          }
                          style={{
                            ...buttonBase,
                            padding: "6px 10px",
                            background: "#eef2ff",
                            border: "1px solid #c7d2fe",
                            color: "#3730a3",
                            fontSize: 12,
                          }}
                        >
                          {isOpen ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${row.submissionId}-detail`}>
                        <td
                          colSpan={8}
                          style={{
                            padding: 14,
                            background: ui.colors.bgSoft,
                            borderBottom: `1px solid ${ui.colors.border}`,
                          }}
                        >
                          <AiSubmissionViewer assignmentId={row.assignmentId} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}