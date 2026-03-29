import { useEffect, useState } from "react";
import { getDeveloperPerformanceOverview } from "../features/task-management/api/taskManagementApi";
import type { DeveloperPerformanceOverviewItem } from "../features/task-management/api/taskManagementApi";

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
    return <div>Loading developer performance...</div>;
  }

  if (error) {
    return <div style={{ color: "crimson" }}>{error}</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Developer Performance</h2>
      <p style={{ color: "#666" }}>
        Overview of developer progress and evaluation scores.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: 10 }}>Developer</th>
              <th style={{ textAlign: "left", padding: 10 }}>Projects</th>
              <th style={{ textAlign: "left", padding: 10 }}>Assigned</th>
              <th style={{ textAlign: "left", padding: 10 }}>Accepted</th>
              <th style={{ textAlign: "left", padding: 10 }}>Rejected</th>
              <th style={{ textAlign: "left", padding: 10 }}>Submitted</th>
              <th style={{ textAlign: "left", padding: 10 }}>In Progress</th>
              <th style={{ textAlign: "left", padding: 10 }}>Acceptance Rate</th>
              <th style={{ textAlign: "left", padding: 10 }}>Average Score</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 12, color: "#777" }}>
                  No developer performance data found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.userId} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 10 }}>
                    <div>{item.username}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{item.email}</div>
                  </td>
                  <td style={{ padding: 10 }}>{item.projectsCount}</td>
                  <td style={{ padding: 10 }}>{item.totalAssigned}</td>
                  <td style={{ padding: 10 }}>{item.acceptedCount}</td>
                  <td style={{ padding: 10 }}>{item.rejectedCount}</td>
                  <td style={{ padding: 10 }}>{item.submittedCount}</td>
                  <td style={{ padding: 10 }}>{item.inProgressCount}</td>
                  <td style={{ padding: 10 }}>{item.acceptanceRate}%</td>
                  <td style={{ padding: 10 }}>{item.averageScore}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}