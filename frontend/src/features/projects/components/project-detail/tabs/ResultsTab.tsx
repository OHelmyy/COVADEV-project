import { Card, MiniStat, SectionTable } from "../ProjectUi";
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

  canRunAnalysis: boolean;
  onRunAnalysis: () => void;
};

function humanizeName(value?: string) {
  if (!value) return "Unknown Function";

  return value
    .replace(/\.(py|js|ts|tsx|jsx|java|cs|php)$/i, "")
    .replace(/-/g, "_");
}

function normalizePath(value?: string) {
  return (value || "").replace(/\\/g, "/");
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

  const clean = normalizePath(codeRef);

  const [withoutLine, linePart] = clean.split("@L");
  const lineNumber = linePart ? `Line ${linePart}` : "";

  const lastColonIndex = withoutLine.lastIndexOf(":");
  const hasSymbol = lastColonIndex > -1 && !withoutLine.slice(0, lastColonIndex).endsWith("http");

  const pathPart = hasSymbol
    ? withoutLine.slice(0, lastColonIndex)
    : withoutLine;

  const symbolPart = hasSymbol
    ? withoutLine.slice(lastColonIndex + 1)
    : "";

  const pathParts = pathPart.split("/");
  const fileName = pathParts.pop() || pathPart || "Unknown file";
  const folderPath = pathParts.join("/");

  return {
    functionName: symbolPart ? humanizeName(symbolPart) : humanizeName(fileName),
    fileName,
    folderPath,
    lineNumber,
  };
}

function getFileValue(file: FileRow, keys: string[]) {
  const anyFile = file as Record<string, unknown>;

  for (const key of keys) {
    const value = anyFile[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function getFileName(file: FileRow) {
  const raw =
    getFileValue(file, ["originalName", "original_name", "name", "filename", "path", "file_path"]) ||
    "Unknown file";

  const clean = normalizePath(raw);
  const name = clean.split("/").pop() || clean;

  if (/^\d+$/.test(name)) {
    return "Indexed code file";
  }

  return name;
}

function getFilePath(file: FileRow) {
  const raw = getFileValue(file, ["path", "file_path", "relativePath", "relative_path"]);
  const clean = normalizePath(raw);

  if (!clean) return "";

  const parts = clean.split("/");

  if (parts.length <= 1) return "";

  parts.pop();
  return parts.join("/");
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "py") return "🐍";
  if (["js", "jsx"].includes(ext || "")) return "🟨";
  if (["ts", "tsx"].includes(ext || "")) return "🔷";
  if (ext === "java") return "☕";
  if (ext === "cs") return "🟪";
  if (ext === "php") return "🐘";

  return "📄";
}

function CodeReferenceCell({ codeRef }: { codeRef?: string }) {
  const ref = formatCodeRef(codeRef);

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
        <div
          title={ref.folderPath}
          style={{
            marginTop: 2,
            fontSize: 11,
            color: "#999",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 320,
          }}
        >
          {ref.folderPath}
        </div>
      ) : null}
    </div>
  );
}

function ScoreCell({ score }: { score: number | string | null | undefined }) {
  const val = Number(score) || 0;
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
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontWeight: 800, minWidth: 45, color: ui.colors.text }}>
        {val.toFixed(3)}
      </span>

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
    </div>
  );
}

function SectionTitle({
  label,
  color,
  background,
  border,
}: {
  label: string;
  color: string;
  background: string;
  border: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "8px 16px",
        borderRadius: 999,
        background,
        border,
        color,
        width: "fit-content",
        margin: "0 auto 12px auto",
        fontWeight: 900,
        fontSize: 15,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
        }}
      />
      {label}
    </div>
  );
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
  canRunAnalysis,
  onRunAnalysis,
}: Props) {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Analysis Output</h3>
          <div style={{ marginTop: 4, color: ui.colors.textMuted, fontSize: 13 }}>
            Run the latest BPMN-to-code comparison and review the updated results below.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={onRefresh}
            style={{
              padding: "11px 14px",
              borderRadius: 12,
              border: `1px solid ${ui.colors.border}`,
              background: "#fff",
              color: ui.colors.text,
              fontWeight: 800,
              cursor: resultsLoading ? "not-allowed" : "pointer",
            }}
            disabled={resultsLoading}
          >
            {resultsLoading ? "Refreshing..." : "Refresh Results"}
          </button>

          {canRunAnalysis ? (
            <button
              onClick={onRunAnalysis}
              style={{
                padding: "14px 22px",
                borderRadius: 14,
                border: "none",
                background: ui.colors.primary,
                color: "#fff",
                fontWeight: 900,
                fontSize: 15,
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(37, 99, 235, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              ▶ Run Analysis
            </button>
          ) : null}
        </div>
      </div>

      {resultsError ? (
        <div style={{ color: "#a00", marginTop: 8 }}>{resultsError}</div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 12,
          marginTop: 12,
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: ui.radius.lg,
            background: ui.colors.bgSoft,
            border: `1px solid ${ui.colors.border}`,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: ui.colors.textMuted,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: ui.colors.primary,
              }}
            />
            Tasks
          </div>
          <div
            style={{
              marginTop: 6,
              fontWeight: 900,
              fontSize: 24,
              color: ui.colors.text,
            }}
          >
            {tasksCount}
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: ui.radius.lg,
            background: "#f0fdf4",
            border: "1px solid #dcfce7",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#166534",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            Matched
          </div>
          <div
            style={{
              marginTop: 6,
              fontWeight: 900,
              fontSize: 24,
              color: "#166534",
            }}
          >
            {matched.length}
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: ui.radius.lg,
            background: "#fff5f5",
            border: "1px solid #fee2e2",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#c53030",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#e53e3e",
              }}
            />
            Missing
          </div>
          <div
            style={{
              marginTop: 6,
              fontWeight: 900,
              fontSize: 24,
              color: "#c53030",
            }}
          >
            {missing.length}
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: ui.radius.lg,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#b45309",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#f59e0b",
              }}
            />
            Extra
          </div>
          <div
            style={{
              marginTop: 6,
              fontWeight: 900,
              fontSize: 24,
              color: "#b45309",
            }}
          >
            {extra.length}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 12,
        }}
      >
        <MiniStat label="Coverage" value={`${coverage.toFixed(1)}%`} />
        <MiniStat label="Avg Similarity (matched)" value={scoreAvg.toFixed(3)} />
      </div>

      <SectionTable
        title={
          <SectionTitle
            label="Matched Results"
            color="#166534"
            background="#f0fdf4"
            border="1px solid #dcfce7"
          />
        }
        emptyText="No matched results yet."
        table={
          matched.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>BPMN Task</th>
                  <th style={th}>Code Function</th>
                  <th style={th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {matched.slice(0, 50).map((item, index) => (
                  <tr key={`${item.task?.task_id ?? "task"}-${item.code_ref ?? "code"}-${index}`}>
                    <td style={td}>
                      <div style={{ fontWeight: 800 }}>
                        {item.task?.name || "Unnamed BPMN Task"}
                      </div>
                      <div style={{ color: "#888", fontSize: 12 }}>
                        {item.task?.task_id || "No task ID"}
                      </div>
                    </td>

                    <td style={td}>
                      <CodeReferenceCell codeRef={item.code_ref} />
                    </td>

                    <td style={td}>
                      <ScoreCell score={item.similarity_score} />
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
          <SectionTitle
            label="Missing Tasks"
            color="#c53030"
            background="#fff5f5"
            border="1px solid #fee2e2"
          />
        }
        emptyText="No missing tasks."
        table={
          missing.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>BPMN Task</th>
                  <th style={th}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {missing.slice(0, 50).map((item) => (
                  <tr key={item.task_id}>
                    <td style={td}>
                      <div style={{ fontWeight: 800 }}>
                        {item.name || "Unnamed BPMN Task"}
                      </div>
                      <div style={{ color: "#888", fontSize: 12 }}>
                        {item.task_id || "No task ID"}
                      </div>
                    </td>

                    <td style={td}>
                      {item.reason || "No matching code implementation was found."}
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
          <SectionTitle
            label="Extra Code"
            color="#b45309"
            background="#fff7ed"
            border="1px solid #fed7aa"
          />
        }
        emptyText="No extra results."
        table={
          extra.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Code Function</th>
                  <th style={th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {extra.slice(0, 50).map((item, index) => (
                  <tr key={`${item.code_ref ?? "extra"}-${index}`}>
                    <td style={td}>
                      <CodeReferenceCell codeRef={item.code_ref} />
                    </td>

                    <td style={td}>
                      <ScoreCell score={item.similarity_score} />
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