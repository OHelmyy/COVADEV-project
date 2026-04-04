import { useEffect, useMemo, useState } from "react";
import {
  getMyPerformanceInsights,
  type MyPerformanceInsightsResponse,
} from "../features/task-management/api/taskManagementApi";
import { cardBase, ui } from "../theme/ui";

function statTone(value: number) {
  if (value >= 85) {
    return {
      bg: ui.colors.successSoft,
      color: ui.colors.success,
      border: "#bbf7d0",
    };
  }
  if (value >= 70) {
    return {
      bg: ui.colors.warningSoft,
      color: ui.colors.warning,
      border: "#fde68a",
    };
  }
  return {
    bg: ui.colors.dangerSoft,
    color: ui.colors.danger,
    border: "#fecaca",
  };
}

function statusBadge(status: string) {
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
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${ui.colors.border}`,
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function metricCard(label: string, value: string | number, sub?: string) {
  return (
    <div
      style={{
        ...cardBase,
        padding: 18,
        minWidth: 220,
        flex: "1 1 220px",
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
      }}
    >
      <div style={{ fontSize: 13, color: ui.colors.textMuted }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: ui.colors.text }}>
        {value}
      </div>
      {sub ? (
        <div style={{ marginTop: 8, fontSize: 13, color: ui.colors.textMuted }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export default function MyInsightsPage() {
  const [data, setData] = useState<MyPerformanceInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const res = await getMyPerformanceInsights();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load your insights");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const scoreTone = useMemo(
    () => statTone(data?.summary.averageScore ?? 0),
    [data]
  );

  if (loading) {
    return (
      <div style={{ ...cardBase, padding: 18 }}>
        <div style={{ fontWeight: 900, color: ui.colors.text }}>
          Loading your insights...
        </div>
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

  if (!data) return null;

  const { summary, projects, recentAssignments, ranking } = data;
  const maxScore = Math.max(100, ...ranking.topDevelopers.map((item) => item.averageScore));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          ...cardBase,
          padding: 22,
          background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
          color: "#fff",
          boxShadow: "0 18px 34px rgba(15,61,145,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>My Insights</h1>
            <p style={{ margin: "8px 0 0", opacity: 0.96, lineHeight: 1.6 }}>
              Personal performance dashboard based on assigned tasks, review outcomes,
              evaluator scores, and ranking against other developers.
            </p>
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.22)",
              minWidth: 220,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.88 }}>Logged in as</div>
            <div style={{ marginTop: 4, fontWeight: 900, fontSize: 18 }}>{summary.username}</div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.9 }}>{summary.email}</div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.95 }}>
              Rank: <strong>#{ranking.myRank?.rank ?? "-"}</strong> of {ranking.totalDevelopers}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {metricCard("Projects", summary.projectsCount)}
        {metricCard("Assigned Tasks", summary.totalAssigned)}
        {metricCard("Accepted", summary.acceptedCount)}
        {metricCard("Acceptance Rate", `${summary.acceptanceRate}%`)}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {metricCard("In Progress", summary.inProgressCount)}
        {metricCard("Submitted", summary.submittedCount)}
        {metricCard("Rejected", summary.rejectedCount)}
        <div
          style={{
            ...cardBase,
            padding: 18,
            minWidth: 220,
            flex: "1 1 220px",
            background: scoreTone.bg,
            color: scoreTone.color,
            border: `1px solid ${scoreTone.border}`,
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.9 }}>Average Score</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>
            {summary.averageScore}
          </div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            Based on saved evaluator assessments
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18 }}>
        <div
          style={{
            ...cardBase,
            padding: 18,
            background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div>
              <h3 style={{ margin: 0, color: ui.colors.text }}>Performance Summary</h3>
              <div style={{ color: ui.colors.textMuted, marginTop: 6, fontSize: 14 }}>
                A quick view of your current execution quality.
              </div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                background: scoreTone.bg,
                color: scoreTone.color,
                border: `1px solid ${ui.colors.border}`,
                fontWeight: 900,
              }}
            >
              Overall Score: {summary.averageScore}
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  fontSize: 13,
                  color: ui.colors.textMuted,
                }}
              >
                <span>Acceptance Rate</span>
                <span>{summary.acceptanceRate}%</span>
              </div>
              <div
                style={{
                  height: 12,
                  borderRadius: 999,
                  background: ui.colors.bgSoft,
                  overflow: "hidden",
                  border: `1px solid ${ui.colors.border}`,
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, summary.acceptanceRate))}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #0f3d91 0%, #06b6d4 100%)",
                  }}
                />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  fontSize: 13,
                  color: ui.colors.textMuted,
                }}
              >
                <span>Average Score</span>
                <span>{summary.averageScore}/100</span>
              </div>
              <div
                style={{
                  height: 12,
                  borderRadius: 999,
                  background: ui.colors.bgSoft,
                  overflow: "hidden",
                  border: `1px solid ${ui.colors.border}`,
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, summary.averageScore))}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...cardBase, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, color: ui.colors.text }}>Ranking vs Developers</h3>
              <div style={{ color: ui.colors.textMuted, marginTop: 6, fontSize: 14 }}>
                Your position compared with other developers.
              </div>
            </div>
            <div
              style={{
                alignSelf: "start",
                padding: "8px 12px",
                borderRadius: 999,
                background: ui.colors.primarySoft,
                color: ui.colors.primary,
                fontWeight: 900,
                border: `1px solid ${ui.colors.border}`,
              }}
            >
              #{ranking.myRank?.rank ?? "-"}
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {ranking.topDevelopers.length === 0 ? (
              <div style={{ color: ui.colors.textMuted }}>No ranking data found.</div>
            ) : (
              ranking.topDevelopers.map((dev) => {
                const isMe = dev.userId === summary.userId;
                return (
                  <div key={dev.userId} style={{ display: "grid", gap: 6 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "44px 1fr 70px",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: isMe ? ui.colors.primarySoft : ui.colors.bgSoft,
                          color: isMe ? ui.colors.primary : ui.colors.text,
                          fontWeight: 900,
                          border: `1px solid ${ui.colors.border}`,
                        }}
                      >
                        #{dev.rank}
                      </div>

                      <div>
                        <div style={{ fontWeight: 800, color: ui.colors.text }}>
                          {dev.username} {isMe ? "(You)" : ""}
                        </div>
                        <div style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
                          Score {dev.averageScore} • Acceptance {dev.acceptanceRate}%
                        </div>
                      </div>

                      <div style={{ textAlign: "right", fontWeight: 900, color: ui.colors.text }}>
                        {dev.averageScore}
                      </div>
                    </div>

                    <div
                      style={{
                        height: 10,
                        borderRadius: 999,
                        background: ui.colors.bgSoft,
                        overflow: "hidden",
                        border: `1px solid ${ui.colors.border}`,
                      }}
                    >
                      <div
                        style={{
                          width: `${(dev.averageScore / maxScore) * 100}%`,
                          height: "100%",
                          background: isMe
                            ? "linear-gradient(90deg, #0f3d91 0%, #06b6d4 100%)"
                            : "linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

    

      <div style={{ ...cardBase, overflow: "hidden" }}>
        <div style={{ padding: 18, borderBottom: `1px solid ${ui.colors.border}` }}>
          <h3 style={{ margin: 0, color: ui.colors.text }}>Per Project Breakdown</h3>
          <div style={{ color: ui.colors.textMuted, marginTop: 6, fontSize: 14 }}>
            Your performance grouped by project.
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: ui.colors.bgSoft }}>
                <th style={{ textAlign: "left", padding: 14 }}>Project</th>
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
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 20, color: ui.colors.textMuted, textAlign: "center" }}>
                    No project performance data found yet.
                  </td>
                </tr>
              ) : (
                projects.map((item) => (
                  <tr key={item.projectId}>
                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                      <div style={{ fontWeight: 800, color: ui.colors.text }}>{item.projectName}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: ui.colors.textMuted }}>
                        ID: {item.projectId}
                      </div>
                    </td>
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

      <div style={{ ...cardBase, overflow: "hidden" }}>
        <div style={{ padding: 18, borderBottom: `1px solid ${ui.colors.border}` }}>
          <h3 style={{ margin: 0, color: ui.colors.text }}>Recent Evaluated / Reviewed Tasks</h3>
          <div style={{ color: ui.colors.textMuted, marginTop: 6, fontSize: 14 }}>
            Latest task outcomes with evaluator feedback when available.
          </div>
        </div>

        <div style={{ display: "grid", gap: 14, padding: 18 }}>
          {recentAssignments.length === 0 ? (
            <div style={{ color: ui.colors.textMuted }}>No recent task activity found.</div>
          ) : (
            recentAssignments.map((item) => (
              <div
                key={item.assignmentId}
                style={{
                  border: `1px solid ${ui.colors.border}`,
                  borderRadius: ui.radius.lg,
                  padding: 16,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900, color: ui.colors.text, fontSize: 16 }}>
                      {item.task.name}
                    </div>
                    <div style={{ marginTop: 4, color: ui.colors.textMuted, fontSize: 13 }}>
                      {item.projectName} • {item.task.taskId}
                    </div>
                  </div>

                  <div>{statusBadge(item.status)}</div>
                </div>

                {item.evaluation ? (
                  <div
                    style={{
                      marginTop: 14,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div style={{ ...cardBase, padding: 12, background: ui.colors.bgSoft }}>
                      <div style={{ fontSize: 12, color: ui.colors.textMuted }}>Final Score</div>
                      <div style={{ marginTop: 6, fontWeight: 900, fontSize: 20 }}>
                        {item.evaluation.finalScore}
                      </div>
                    </div>

                    <div style={{ ...cardBase, padding: 12, background: ui.colors.bgSoft }}>
                      <div style={{ fontSize: 12, color: ui.colors.textMuted }}>Correctness</div>
                      <div style={{ marginTop: 6, fontWeight: 800 }}>{item.evaluation.correctnessScore}</div>
                    </div>

                    <div style={{ ...cardBase, padding: 12, background: ui.colors.bgSoft }}>
                      <div style={{ fontSize: 12, color: ui.colors.textMuted }}>Quality</div>
                      <div style={{ marginTop: 6, fontWeight: 800 }}>{item.evaluation.qualityScore}</div>
                    </div>

                    <div style={{ ...cardBase, padding: 12, background: ui.colors.bgSoft }}>
                      <div style={{ fontSize: 12, color: ui.colors.textMuted }}>Timeliness</div>
                      <div style={{ marginTop: 6, fontWeight: 800 }}>{item.evaluation.timelinessScore}</div>
                    </div>

                    <div style={{ ...cardBase, padding: 12, background: ui.colors.bgSoft }}>
                      <div style={{ fontSize: 12, color: ui.colors.textMuted }}>Communication</div>
                      <div style={{ marginTop: 6, fontWeight: 800 }}>{item.evaluation.communicationScore}</div>
                    </div>
                  </div>
                ) : null}

                {item.evaluation?.comments ? (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 14,
                      borderRadius: ui.radius.lg,
                      background: ui.colors.bgSoft,
                      border: `1px solid ${ui.colors.border}`,
                    }}
                  >
                    <div style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 6 }}>
                      Evaluator Comments
                    </div>
                    <div style={{ color: ui.colors.text, lineHeight: 1.65 }}>
                      {item.evaluation.comments}
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}