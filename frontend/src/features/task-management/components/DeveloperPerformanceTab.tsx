import React, { useEffect, useState } from "react";
import { getProjectDeveloperPerformance } from "../api/taskManagementApi";
import type { DeveloperPerformanceItem } from "../types";
import { cardBase, ui } from "../../../theme/ui";
import ErrorModal from "../../../components/ErrorModal";
import { buildTaskManagementError } from "../utils/taskManagementError";

type Props = {
  projectId: number;
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

function metricBadge(value: number | string, tone: "neutral" | "success" | "warning" = "neutral") {
  const bg =
    tone === "success"
      ? ui.colors.successSoft
      : tone === "warning"
      ? ui.colors.warningSoft
      : ui.colors.bgSoft;

  const color =
    tone === "success"
      ? ui.colors.success
      : tone === "warning"
      ? ui.colors.warning
      : ui.colors.primary;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 54,
        padding: "6px 10px",
        borderRadius: 999,
        background: bg,
        color,
        fontWeight: 800,
        fontSize: 12,
        border: `1px solid ${ui.colors.border}`,
      }}
    >
      {value}
    </span>
  );
}

export default function DeveloperPerformanceTab({ projectId }: Props) {
  const [items, setItems] = useState<DeveloperPerformanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorModal, setErrorModal] = useState<ErrorState>(EMPTY_ERROR);

  async function loadPerformance() {
    setLoading(true);
    setError("");

    try {
      const data = await getProjectDeveloperPerformance(projectId);
      setItems(data.items || []);
    } catch (err: any) {
      const message = err.message || "Failed to load developer performance";
      setError(message);

      const info = buildTaskManagementError(
        "load project developer performance",
        err,
        "Developer performance load failed"
      );

      setErrorModal({
        open: true,
        title: info.title,
        message: info.message,
        cause: info.cause,
        details: info.details,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) {
      loadPerformance();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ ...cardBase, padding: 18 }}>
        <div style={{ fontWeight: 900, color: ui.colors.text }}>Loading developer performance...</div>
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
            background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
            color: "#fff",
            boxShadow: "0 18px 34px rgba(15,61,145,0.18)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 22 }}>Developer Performance</h3>
          <div style={{ marginTop: 8, opacity: 0.95, lineHeight: 1.6 }}>
            Performance summary based on task outcomes and evaluator scores.
          </div>
        </div>

        <div style={{ ...cardBase, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: ui.colors.bgSoft, textAlign: "left" }}>
                  {[
                    "Developer",
                    "Assigned",
                    "Accepted",
                    "Rejected",
                    "Submitted",
                    "In Progress",
                    "Acceptance Rate",
                    "Average Score",
                  ].map((head) => (
                    <th
                      key={head}
                      style={{
                        padding: "14px 14px",
                        borderBottom: `1px solid ${ui.colors.border}`,
                        color: ui.colors.textMuted,
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: 20,
                        color: ui.colors.textMuted,
                        textAlign: "center",
                      }}
                    >
                      No developer performance data found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.membershipId}>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                        <div style={{ fontWeight: 800, color: ui.colors.text }}>{item.username}</div>
                        <div style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
                          {item.email}
                        </div>
                      </td>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {metricBadge(item.totalAssigned)}
                      </td>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {metricBadge(item.acceptedCount, "success")}
                      </td>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {metricBadge(item.rejectedCount, "warning")}
                      </td>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {metricBadge(item.submittedCount)}
                      </td>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {metricBadge(item.inProgressCount)}
                      </td>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}`, fontWeight: 800 }}>
                        {item.acceptanceRate}%
                      </td>
                      <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}`, fontWeight: 900 }}>
                        {item.averageScore}
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