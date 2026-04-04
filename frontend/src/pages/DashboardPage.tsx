import { useEffect, useState } from "react";
import StatCard from "../components/StatCard";
import StatusMessage from "../components/StatusMessage";
import { fetchDashboardStats } from "../api/dashboard";
import type { DashboardStats, DashboardProjectSummary } from "../api/types";
import { cardBase, ui } from "../theme/ui";

type LoadState = "idle" | "loading" | "success" | "error";

export default function DashboardPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<DashboardStats | null>(null);
  const [errorText, setErrorText] = useState<string>("");

  async function load() {
    try {
      setState("loading");
      setErrorText("");
      const res = await fetchDashboardStats();
      setData(res);
      setState("success");
    } catch (e: any) {
      setState("error");
      setErrorText(e?.message ?? "Failed to load dashboard data");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const badgeStyle = (status: DashboardProjectSummary["status"]): React.CSSProperties => ({
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: `1px solid ${ui.colors.border}`,
    color: status === "done" ? ui.colors.primary : ui.colors.warning,
    background: status === "done" ? ui.colors.primarySoft : ui.colors.warningSoft,
    textTransform: "capitalize",
    display: "inline-flex",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          ...cardBase,
          padding: 20,
          background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>Dashboard</h1>
        <p style={{ marginTop: 8, opacity: 0.96, maxWidth: 760, lineHeight: 1.7 }}>
          Overview of projects, uploads, and analysis progress across the COVADEV platform.
        </p>
      </div>

      {state === "loading" || state === "idle" ? (
        <StatusMessage title="Loading dashboard..." message="Fetching latest stats from backend." />
      ) : null}

      {state === "error" ? (
        <StatusMessage
          title="Failed to load dashboard"
          message={`${errorText}. Make sure Django is running and the endpoint exists: /api/reports/dashboard/`}
          onRetry={load}
        />
      ) : null}

      {state === "success" && data ? (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <StatCard label="Total Projects" value={data.totalProjects} />
            <StatCard label="Total Uploads" value={data.totalUploads} />
            <StatCard label="Analyses Pending" value={data.analysesPending} />
            <StatCard label="Analyses Done" value={data.analysesDone} />
          </div>

          <div style={{ ...cardBase, padding: 18 }}>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Recent Projects</h2>
            <div style={{ color: ui.colors.textMuted, marginBottom: 14 }}>
              Recently updated project workspaces and their current analysis state.
            </div>

            {data.recentProjects.length === 0 ? (
              <div style={{ color: ui.colors.textMuted, fontSize: 14 }}>No projects yet.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ textAlign: "left", background: ui.colors.bgSoft }}>
                      <th style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>
                        Project
                      </th>
                      <th style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>
                        Last Updated
                      </th>
                      <th style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentProjects.map((p: DashboardProjectSummary) => (
                      <tr key={p.id}>
                        <td style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>
                          <div style={{ fontWeight: 800, color: ui.colors.text }}>{p.name}</div>
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>
                          {new Date(p.updatedAt).toISOString().slice(0, 10)}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>
                          <span style={badgeStyle(p.status)}>{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}