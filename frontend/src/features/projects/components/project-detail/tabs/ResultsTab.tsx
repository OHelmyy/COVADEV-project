import { Card, MiniStat, SectionTable, Stat } from "../ProjectUi";
import { td, th } from "../../../utils/projectDetail";
import type {
  FileRow,
  MatchRow,
  MissingResultRow,
} from "../../../types/projectDetail";

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
        <Stat label="Tasks" value={tasksCount} />
        <Stat label="Matched" value={matched.length} />
        <Stat label="Missing" value={missing.length} />
        <Stat label="Extra" value={extra.length} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <MiniStat label="Coverage" value={`${coverage.toFixed(1)}%`} />
        <MiniStat label="Avg Similarity (matched)" value={scoreAvg.toFixed(3)} />
      </div>

      <SectionTable
        title="Matched"
        emptyText="No matched results yet."
        table={
          matched.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Task</th>
                  <th style={th}>Code Ref</th>
                  <th style={th}>Score</th>
                  <th style={th}>Status</th>
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
                      <code style={{ fontSize: 12 }}>{item.code_ref}</code>
                    </td>
                    <td style={td}>{(Number(item.similarity_score) || 0).toFixed(3)}</td>
                    <td style={td}>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null
        }
      />

      <SectionTable
        title="Missing"
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
                      <div style={{ fontWeight: 800 }}>{item.name}</div>
                      <div style={{ color: "#888", fontSize: 12 }}>{item.task_id}</div>
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
        title="Extra"
        emptyText="No extra results."
        table={
          extra.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Code Ref</th>
                  <th style={th}>Score</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {extra.slice(0, 50).map((item, index) => (
                  <tr key={`${item.code_ref}-${index}`}>
                    <td style={td}>
                      <code style={{ fontSize: 12 }}>{item.code_ref}</code>
                    </td>
                    <td style={td}>{(Number(item.similarity_score) || 0).toFixed(3)}</td>
                    <td style={td}>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null
        }
      />

      <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Indexed Code Files (preview)</div>
        {files.length === 0 ? (
          <div style={{ color: "#888" }}>No files indexed yet.</div>
        ) : (
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(files.slice(0, 30), null, 2)}
          </pre>
        )}
      </div>
    </Card>
  );
}