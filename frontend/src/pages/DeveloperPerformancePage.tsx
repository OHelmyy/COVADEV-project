import { useEffect, useState } from "react";
import { getDeveloperPerformanceOverview } from "../features/task-management/api/taskManagementApi";
import type { DeveloperPerformanceOverviewItem } from "../features/task-management/api/taskManagementApi";
import { cardBase, ui } from "../theme/ui";

export default function DeveloperPerformancePage() {
  const [items, setItems] = useState<DeveloperPerformanceOverviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const data = await getDeveloperPerformanceOverview();
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load developer performance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ ...cardBase, padding: 18 }}>
        <div style={{ fontWeight: 900 }}>Loading developer performance...</div>
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
          borderColor: "#fecaca",
          color: ui.colors.danger,
          fontWeight: 700,
        }}
      >
        {error}
      </div>
    );
  }

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
        <h2 style={{ margin: 0, fontSize: 28 }}>Developer Performance</h2>
        <p style={{ marginTop: 8, opacity: 0.96 }}>
          Overview of developer progress and evaluation scores across projects.
        </p>
      </div>

      <div style={{ ...cardBase, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${ui.colors.border}`, background: ui.colors.bgSoft }}>
                <th style={{ textAlign: "left", padding: 14 }}>Developer</th>
                <th style={{ textAlign: "left", padding: 14 }}>Projects</th>
                <th style={{ textAlign: "left", padding: 14 }}>Assigned</th>
                <th style={{ textAlign: "left", padding: 14 }}>Accepted</th>
                <th style={{ textAlign: "left", padding: 14 }}>Rejected</th>
                <th style={{ textAlign: "left", padding: 14 }}>Submitted</th>
                <th style={{ textAlign: "left", padding: 14 }}>In Progress</th>
                <th style={{ textAlign: "left", padding: 14 }}>Acceptance Rate</th>
                <th style={{ textAlign: "left", padding: 14 }}>Average Score</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 20, color: ui.colors.textMuted, textAlign: "center" }}>
                    No developer performance data found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.userId}>
                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                      <div style={{ fontWeight: 800, color: ui.colors.text }}>{item.username}</div>
                      <div style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
                        {item.email}
                      </div>
                    </td>
                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>{item.projectsCount}</td>
                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>{item.totalAssigned}</td>
                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>{item.acceptedCount}</td>
                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>{item.rejectedCount}</td>
                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>{item.submittedCount}</td>
                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>{item.inProgressCount}</td>
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
  );
}