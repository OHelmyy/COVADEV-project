import React, { useEffect, useState } from "react";
import { getProjectDeveloperPerformance } from "../api/taskManagementApi";
import type { DeveloperPerformanceItem } from "../types";

type Props = {
  projectId: number;
};

export default function DeveloperPerformanceTab({ projectId }: Props) {
  const [items, setItems] = useState<DeveloperPerformanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadPerformance() {
    setLoading(true);
    setError("");

    try {
      const data = await getProjectDeveloperPerformance(projectId);
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load developer performance");
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
    return <div>Loading developer performance...</div>;
  }

  if (error) {
    return <div style={{ color: "crimson" }}>{error}</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Developer Performance</h3>
        <div style={{ color: "#666", marginTop: 6 }}>
          Performance summary based on task outcomes and evaluator scores.
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: 10 }}>Developer</th>
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
                <td colSpan={8} style={{ padding: 12, color: "#777" }}>
                  No developer performance data found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.membershipId} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 10 }}>
                    <div>{item.username}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{item.email}</div>
                  </td>
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