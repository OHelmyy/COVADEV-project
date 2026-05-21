import { Card, MiniStat, SectionTable, Stat } from "../ProjectUi";
import { td, th } from "../../../utils/projectDetail";
import type {
  FileRow,
  MatchRow,
  MissingResultRow,
} from "../../../types/projectDetail";
import { ui } from "../../../../../theme/ui";

type Props = {
  resultsLoading: boolean;
  resultsError: string;
  tasksCount: number;
  matched: MatchRow[];
  missing: MissingResultRow[];
  extra: MatchRow[];
  coverage: number;
  scoreAvg: number;
  files: FileRow[];
  onRefresh: () => void;
};

function humanizeName(value?: string) {
  if (!value) return "Unknown Function";

  return value
    .replace(/\.(py|js|ts|tsx|jsx|java|cs|php)$/i, "")
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCodeRef(codeRef?: string) {
  if (!codeRef) {
    return {
      functionName: "Unknown Function",
      fileName: "Unknown file",
      folderPath: "",
      lineNumber: "",
    };
  }

  const clean = codeRef.replace(/\\/g, "/");

  // Example: path/to/file.py:function_name@L22
  const [withoutLine, linePart] = clean.split("@L");
  const lineNumber = linePart ? `Line ${linePart}` : "";

  const [pathPart, symbolPart] = withoutLine.includes(":")
    ? withoutLine.split(":")
    : [withoutLine, ""];

  const pathParts = pathPart.split("/");
  const fileName = pathParts.pop() || pathPart;
  const folderPath = pathParts.join("/");

  const functionName = symbolPart
    ? humanizeName(symbolPart)
    : humanizeName(fileName);

  return {
    functionName,
    fileName,
    folderPath,
    lineNumber,
  };
}

export default function ResultsTab({
  resultsLoading,
  resultsError,
  tasksCount,
  matched,
  missing,
  extra,
  coverage,
  scoreAvg,
  files,
  onRefresh,
}: Props) {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ marginTop: 0 }}>Analysis Output</h3>
        <button
          onClick={onRefresh}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          disabled={resultsLoading}
        >
          {resultsLoading ? "Refreshing..." : "Refresh results"}
        </button>
      </div>

      {resultsError ? <div style={{ color: "#a00", marginTop: 8 }}>{resultsError}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
        <div
          style={{
            padding: 14,
            borderRadius: ui.radius.lg,
            background: ui.colors.bgSoft,
            border: `1px solid ${ui.colors.border}`,
          }}
        >
          <div style={{ fontSize: 13, color: ui.colors.textMuted, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: ui.colors.primary }} />
            Tasks
          </div>
          <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24, color: ui.colors.text }}>{tasksCount}</div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: ui.radius.lg,
            background: "#f0fdf4",
            border: "1px solid #dcfce7",
          }}
        >
          <div style={{ fontSize: 13, color: "#166534", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            Matched
          </div>
          <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24, color: "#166534" }}>{matched.length}</div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: ui.radius.lg,
            background: "#fff5f5",
            border: "1px solid #fee2e2",
          }}
        >
          <div style={{ fontSize: 13, color: "#c53030", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#e53e3e" }} />
            Missing
          </div>
          <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24, color: "#c53030" }}>{missing.length}</div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: ui.radius.lg,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
          }}
        >
          <div style={{ fontSize: 13, color: "#b45309", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
            Extra
          </div>
          <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24, color: "#b45309" }}>{extra.length}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <MiniStat label="Coverage" value={`${coverage.toFixed(1)}%`} />
        <MiniStat label="Avg Similarity (matched)" value={scoreAvg.toFixed(3)} />
      </div>

      <SectionTable
        title={
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            background: "#f0fdf4",
            border: "1px solid #dcfce7",
            color: "#166534",
            width: "fit-content",
            margin: "0 auto 12px auto",
            fontWeight: 900,
            fontSize: 15
          }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            Matched Results
          </div>
        }
        emptyText="No matched results yet."
        table={
          matched.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Task</th>
                  <th style={th}>Code Ref</th>
                  <th style={th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {matched.slice(0, 50).map((item, index) => (
                  <tr key={`${item.task?.task_id ?? "none"}-${index}`}>
                    <td style={td}>
                      <div style={{ fontWeight: 800 }}>{item.task?.name}</div>
                      <div style={{ color: "#888", fontSize: 12 }}>{item.task?.task_id}</div>
                    </td>
                    <td style={td}>
                      {(() => {
                        const ref = formatCodeRef(item.code_ref);

                        return (
                          <div>
                            <div style={{ fontWeight: 900, color: ui.colors.text }}>
                              {ref.functionName}
                            </div>

                            <div style={{ marginTop: 4, fontSize: 12, color: ui.colors.textMuted }}>
                              <span style={{ fontWeight: 700 }}>File:</span> {ref.fileName}
                              {ref.lineNumber ? ` • ${ref.lineNumber}` : ""}
                            </div>

                            {ref.folderPath ? (
                              <div style={{ marginTop: 2, fontSize: 11, color: "#999" }}>
                                {ref.folderPath}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

                        {(() => {
                          const val = Number(item.similarity_score) || 0;
                          const pct = Math.min(Math.max(val * 100, 0), 100);
                          const barColor =
                            pct >= 85
                              ? ui.colors.success
                              : pct >= 65
                                ? ui.colors.warning
                                : ui.colors.danger;
                          const bgSoft =
                            pct >= 85
                              ? ui.colors.successSoft
                              : pct >= 65
                                ? ui.colors.warningSoft
                                : ui.colors.dangerSoft;
                          return (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                flex: 1,
                                minWidth: 100,
                              }}
                            >
                              <div
                                style={{
                                  height: 6,
                                  flex: 1,
                                  background: ui.colors.border,
                                  borderRadius: 3,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: "100%",
                                    background: barColor,
                                    borderRadius: 3,
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: barColor,
                                  background: bgSoft,
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  border: `1px solid ${bgSoft}`,
                                }}
                              >
                                {Math.round(pct)}%
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null
        }
      />

      <SectionTable
        title={
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            background: "#fff5f5",
            border: "1px solid #fee2e2",
            color: "#c53030",
            width: "fit-content",
            margin: "0 auto 12px auto",
            fontWeight: 900,
            fontSize: 15
          }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#e53e3e" }} />
            Missing Tasks
          </div>
        }
        emptyText="No missing tasks."
        table={
          missing.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Task</th>
                  <th style={th}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {missing.slice(0, 50).map((item) => (
                  <tr key={item.task_id}>
                    <td style={td}>
                      <div style={{ fontWeight: 900, color: ui.colors.text }}>
                        {item.name || "Unnamed BPMN Task"}
                      </div>

                      {item.task_id ? (
                        <div style={{ marginTop: 4, fontSize: 12, color: ui.colors.textMuted }}>
                          Task ID: {item.task_id}
                        </div>
                      ) : null}
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
        title={
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#b45309",
            width: "fit-content",
            margin: "0 auto 12px auto",
            fontWeight: 900,
            fontSize: 15
          }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
            Extra Code
          </div>
        }
        emptyText="No extra results."
        table={
          extra.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Code Ref</th>
                  <th style={th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {extra.slice(0, 50).map((item, index) => (
                  <tr key={`${item.code_ref}-${index}`}>
                    <td style={td}>
                      <code style={{ fontSize: 12 }}>{item.code_ref}</code>
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

                        {(() => {
                          const val = Number(item.similarity_score) || 0;
                          const pct = Math.min(Math.max(val * 100, 0), 100);
                          const barColor =
                            pct >= 85
                              ? ui.colors.success
                              : pct >= 65
                                ? ui.colors.warning
                                : ui.colors.danger;
                          const bgSoft =
                            pct >= 85
                              ? ui.colors.successSoft
                              : pct >= 65
                                ? ui.colors.warningSoft
                                : ui.colors.dangerSoft;
                          return (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                flex: 1,
                                minWidth: 100,
                              }}
                            >
                              <div
                                style={{
                                  height: 6,
                                  flex: 1,
                                  background: ui.colors.border,
                                  borderRadius: 3,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: "100%",
                                    background: barColor,
                                    borderRadius: 3,
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: barColor,
                                  background: bgSoft,
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  border: `1px solid ${bgSoft}`,
                                }}
                              >
                                {Math.round(pct)}%
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null
        }
      />

    </Card>
  );
}