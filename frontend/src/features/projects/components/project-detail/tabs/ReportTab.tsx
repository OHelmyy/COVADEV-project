import StatusMessage from "../../../../../components/StatusMessage";
import { Card, ScoreBadge, SectionTable, Stat } from "../ProjectUi";
import { td, th } from "../../../utils/projectDetail";
import type { LoadState, ReportPayload } from "../../../types/projectDetail";

type Props = {
  canViewReport: boolean;
  reportState: LoadState;
  reportError: string;
  report: ReportPayload;
  onRefresh: () => void;
  onRetry: () => void;
  onDownloadPdf: () => void;
};

export default function ReportTab({
  canViewReport,
  reportState,
  reportError,
  report,
  onRefresh,
  onRetry,
  onDownloadPdf,
}: Props) {
  return (
    <Card>
      {!canViewReport ? (
        <div style={{ color: "#888" }}>You don't have permission to view this report.</div>
      ) : reportState === "loading" || reportState === "idle" ? (
        <StatusMessage title="Loading report..." message="Fetching report data from backend." />
      ) : reportState === "error" ? (
        <StatusMessage title="Failed to load report" message={reportError} onRetry={onRetry} />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 6 }}>Project Report</h3>
              <div style={{ color: "#666" }}>
                Traceability + Missing/Extra summary for this project.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={onRefresh}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
              >
                Refresh report
              </button>

              <button
                onClick={onDownloadPdf}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  fontWeight: 800,
                }}
              >
                Export PDF
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
            <Stat label="Traceability rows" value={report.traceability.length} />
            <Stat label="Missing tasks" value={report.missingTasks.length} />
            <Stat label="Extra code" value={report.extraCode.length} />
          </div>

          <SectionTable
            title="Task-level Traceability"
            emptyText="No traceability results."
            table={
              report.traceability.length ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th style={th}>Task</th>
                      <th style={th}>Best Match</th>
                      <th style={th}>Similarity</th>
                      <th style={th}>Developer</th>
                      <th style={th}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.traceability.slice(0, 80).map((row, index) => (
                      <tr key={`${row.taskId}-${index}`}>
                        <td style={td}>
                          <div style={{ fontWeight: 800 }}>{row.taskName}</div>
                          <div style={{ color: "#888", fontSize: 12 }}>{row.taskId}</div>
                        </td>
                        <td style={td}>
                          <code style={{ fontSize: 12 }}>{row.bestMatch}</code>
                        </td>
                        <td style={td}>
                          <ScoreBadge value={row.similarity} />
                        </td>
                        <td style={td}>{row.developer}</td>
                        <td style={td}>{row.note ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null
            }
          />

          <SectionTable
            title="Missing Tasks"
            emptyText="No missing tasks."
            table={
              report.missingTasks.length ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th style={th}>Task</th>
                      <th style={th}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.missingTasks.slice(0, 80).map((item, index) => (
                      <tr key={`${item.taskId}-${index}`}>
                        <td style={td}>
                          <div style={{ fontWeight: 800 }}>{item.taskName}</div>
                          <div style={{ color: "#888", fontSize: 12 }}>{item.taskId}</div>
                        </td>
                        <td style={td}>{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null
            }
          />

          <SectionTable
            title="Extra Code"
            emptyText="No extra code detected."
            table={
              report.extraCode.length ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th style={th}>ID</th>
                      <th style={th}>File / Symbol</th>
                      <th style={th}>Developer</th>
                      <th style={th}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.extraCode.slice(0, 80).map((item, index) => (
                      <tr key={`${item.id}-${index}`}>
                        <td style={td}>
                          <div style={{ fontWeight: 800 }}>{item.id}</div>
                        </td>
                        <td style={td}>
                          <div style={{ fontFamily: "monospace", fontSize: 12 }}>{item.file}</div>
                          <div
                            style={{
                              fontFamily: "monospace",
                              fontSize: 12,
                              color: "#555",
                              marginTop: 4,
                            }}
                          >
                            {item.symbol}
                          </div>
                        </td>
                        <td style={td}>{item.developer}</td>
                        <td style={td}>{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null
            }
          />
        </>
      )}
    </Card>
  );
}