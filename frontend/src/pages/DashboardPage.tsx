import { useEffect, useState } from "react";
import StatCard from "../components/StatCard";
import StatusMessage from "../components/StatusMessage";
import { fetchDashboardStats } from "../api/dashboard";
import type { DashboardStats, ProjectSummary } from "../api/types";


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

  const badgeStyle = (status: ProjectSummary["status"]) => ({
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #eee",
    color: status === "done" ? "#094780" : "#8a5a00",
    background: status === "done" ? "#eef5ff" : "#fff5e6",
    textTransform: "capitalize" as const,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <p style={{ marginTop: 6, color: "#555" }}>
          Overview of projects, uploads, and analysis progress.
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
          {/* KPI cards */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <StatCard label="Total Projects" value={data.totalProjects} />
            <StatCard label="Total Uploads" value={data.totalUploads} />
            <StatCard label="Analyses Pending" value={data.analysesPending} />
            <StatCard label="Analyses Done" value={data.analysesDone} />
          </div>

          {/* Recent Projects table */}
          <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Recent Projects</h2>

            {data.recentProjects.length === 0 ? (
              <div style={{ color: "#777", fontSize: 13 }}>No projects yet.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Project</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Last Updated</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentProjects.map((p: ProjectSummary) => (

                    <tr key={p.id}>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>{p.name}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                        {new Date(p.updatedAt).toISOString().slice(0, 10)}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                        <span style={badgeStyle(p.status)}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
