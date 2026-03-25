// frontend/src/pages/ReportsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import DataTable from "../components/DataTable";
import FilterBar from "../components/FilterBar";
import { exportToCsv, exportToHtml } from "../utils/exporters";
import InfoTip from "../components/InfoTip";
import EmptyState from "../components/EmptyState";
import StatusMessage from "../components/StatusMessage";

import { fetchProjectReport } from "../api/reports";
import { fetchProjects } from "../api/projects";
import type { ProjectSummaryApi } from "../api/types";

type TraceRow = {
  taskId: string;
  taskName: string;
  bestMatch: string;
  similarity: number; // 0..1
  developer: string;
  note?: string;
};

type MissingTask = {
  taskId: string;
  taskName: string;
  reason: string;
};

type ExtraCode = {
  id: string;
  file: string;
  symbol: string;
  developer: string;
  reason: string;
};

type ReportPayload = {
  traceability: TraceRow[];
  missingTasks: MissingTask[];
  extraCode: ExtraCode[];
};

type LoadState = "idle" | "loading" | "success" | "error";

function toHtmlTable(headers: string[], rows: string[][]) {
  const thead = `<tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${r.map((c) => `<td>${String(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

export default function ReportsPage() {
  // ✅ hooks must be inside component
  const [searchParams] = useSearchParams();
  const locked = searchParams.get("lock") === "1";
  const lockedProjectId = Number(searchParams.get("projectId") || "");

  // -----------------------------
  // Projects list (selector)
  // -----------------------------
  const [projectsState, setProjectsState] = useState<LoadState>("idle");
  const [projectsError, setProjectsError] = useState("");
  const [projects, setProjects] = useState<ProjectSummaryApi[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  async function loadProjects() {
    try {
      setProjectsState("loading");
      setProjectsError("");

      const res = await fetchProjects();
      const list = res || [];
      setProjects(list);

      if (locked) {
        const ok =
          Number.isFinite(lockedProjectId) &&
          list.some((p) => Number(p.id) === lockedProjectId);

        if (!ok) {
          setProjectsState("error");
          setProjectsError("Invalid project in report link (project not found or no access).");
          return;
        }
        setSelectedProjectId(lockedProjectId);
      } else {
        if (list.length && !selectedProjectId) {
          setSelectedProjectId(Number(list[0].id));
        }
      }

      setProjectsState("success");
    } catch (e: any) {
      setProjectsState("error");
      setProjectsError(e?.message ?? "Failed to load projects");
    }
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // Report data
  // -----------------------------
  const [reportState, setReportState] = useState<LoadState>("idle");
  const [reportError, setReportError] = useState("");
  const [report, setReport] = useState<ReportPayload>({
    traceability: [],
    missingTasks: [],
    extraCode: [],
  });

  async function loadReport(projectId: number) {
    try {
      setReportState("loading");
      setReportError("");

      const res = (await fetchProjectReport(projectId)) as ReportPayload;

      setReport({
        traceability: res?.traceability ?? [],
        missingTasks: res?.missingTasks ?? [],
        extraCode: res?.extraCode ?? [],
      });

      setReportState("success");
    } catch (e: any) {
      setReportState("error");
      setReportError(e?.message ?? "Failed to load report");
    }
  }

  useEffect(() => {
    if (!selectedProjectId) return;
    loadReport(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  // -----------------------------
  // UI controls
  // -----------------------------
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"similarity_desc" | "similarity_asc" | "task_az">("similarity_desc");
  const [lowOnly, setLowOnly] = useState(false);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredTrace = useMemo(() => {
    let rows = [...(report.traceability ?? [])];

    if (lowOnly) rows = rows.filter((r) => (r.similarity ?? 0) < 0.7);

    if (normalizedSearch.length > 0) {
      rows = rows.filter((r) => {
        const hay = `${r.taskId} ${r.taskName} ${r.bestMatch} ${r.developer} ${r.note ?? ""}`.toLowerCase();
        return hay.includes(normalizedSearch);
      });
    }

    if (sort === "similarity_desc") rows.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    if (sort === "similarity_asc") rows.sort((a, b) => (a.similarity ?? 0) - (b.similarity ?? 0));
    if (sort === "task_az") rows.sort((a, b) => (a.taskName ?? "").localeCompare(b.taskName ?? ""));

    return rows;
  }, [lowOnly, normalizedSearch, sort, report.traceability]);

  const filteredMissing = useMemo(() => {
    const rows = report.missingTasks ?? [];
    if (!normalizedSearch) return rows;
    return rows.filter((m) => `${m.taskId} ${m.taskName} ${m.reason}`.toLowerCase().includes(normalizedSearch));
  }, [normalizedSearch, report.missingTasks]);

  const filteredExtra = useMemo(() => {
    const rows = report.extraCode ?? [];
    if (!normalizedSearch) return rows;
    return rows.filter((e) =>
      `${e.id} ${e.file} ${e.symbol} ${e.developer} ${e.reason}`.toLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch, report.extraCode]);

  const formatPercent = (x: number) => `${Math.round(x * 100)}%`;

  const badge = (x: number) => {
    const pct = x * 100;
    const bg = pct >= 80 ? "#eef5ff" : pct >= 70 ? "#fff5e6" : "#ffecec";
    const fg = pct >= 80 ? "#094780" : pct >= 70 ? "#8a5a00" : "#a00000";
    return (
      <span
        style={{
          background: bg,
          color: fg,
          border: "1px solid #eee",
          padding: "4px 10px",
          borderRadius: 999,
          fontWeight: 800,
          fontSize: 12,
        }}
      >
        {formatPercent(x)}
      </span>
    );
  };

  // -----------------------------
  // Global states
  // -----------------------------
  if (projectsState === "loading" || projectsState === "idle") {
    return <StatusMessage title="Loading projects..." message="Fetching your projects list." />;
  }
  if (projectsState === "error") {
    return <StatusMessage title="Failed to load projects" message={projectsError} onRetry={loadProjects} />;
  }
  if (!projects.length) {
    return <EmptyState title="No projects yet" description="Create a project first, then you will see its report here." />;
  }

  if (!selectedProjectId) {
    return <StatusMessage title="Select a project" message="Choose a project to view its report." />;
  }

  if (reportState === "loading" || reportState === "idle") {
    return <StatusMessage title="Loading report..." message="Fetching report data from backend." />;
  }
  if (reportState === "error") {
    return (
      <StatusMessage
        title="Failed to load report"
        message={reportError}
        onRetry={() => loadReport(selectedProjectId)}
      />
    );
  }

  const selectedProject = projects.find((p) => Number(p.id) === selectedProjectId);

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Reports</h1>
          <p style={{ marginTop: 6, color: "#555" }}>
            {locked ? "Locked report view for selected project." : "Choose a project to view its report."}
          </p>
        </div>

        {/* ✅ Selector hidden in locked mode */}
        {!locked ? (
          <div style={{ minWidth: 320 }}>
            <div style={{ fontSize: 12, color: "#777", marginBottom: 6 }}>Project</div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                fontWeight: 700,
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={Number(p.id)}>
                  {p.name} (Role: {p.membership?.role ?? "—"})
                </option>
              ))}
            </select>

            <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>
              Threshold: <b>{selectedProject?.similarityThreshold}</b>
            </div>
          </div>
        ) : (
          <div style={{ minWidth: 320, textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#777" }}>Project</div>
            <div style={{ fontWeight: 900, marginTop: 6 }}>{selectedProject?.name}</div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>
              Locked view • Threshold: <b>{selectedProject?.similarityThreshold}</b>
            </div>
          </div>
        )}
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        sort={sort}
        onSort={(v) => setSort(v as any)}
        showLowOnly={lowOnly}
        onShowLowOnly={setLowOnly}
      />

      {/* Export Buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            exportToCsv(
              "traceability.csv",
              filteredTrace.map((r) => ({
                taskId: r.taskId,
                taskName: r.taskName,
                bestMatch: r.bestMatch,
                similarity: r.similarity,
                developer: r.developer,
                note: r.note ?? "",
              }))
            );
          }}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 800 }}
        >
          Export Traceability CSV
        </button>

        <button
          onClick={() => {
            exportToCsv(
              "missing_tasks.csv",
              filteredMissing.map((m) => ({
                taskId: m.taskId,
                taskName: m.taskName,
                reason: m.reason,
              }))
            );
          }}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 800 }}
        >
          Export Missing CSV
        </button>

        <button
          onClick={() => {
            exportToCsv(
              "extra_code.csv",
              filteredExtra.map((e) => ({
                id: e.id,
                file: e.file,
                symbol: e.symbol,
                developer: e.developer,
                reason: e.reason,
              }))
            );
          }}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 800 }}
        >
          Export Extra CSV
        </button>

        <button
          onClick={() => {
            const body = `
              <h1>COVADEV Report Export</h1>
              <p>Project: <b>${selectedProject?.name ?? ""}</b></p>

              <h2>Traceability</h2>
              ${toHtmlTable(
                ["Task ID", "Task Name", "Best Match", "Similarity", "Developer", "Note"],
                filteredTrace.map((r) => [
                  r.taskId,
                  r.taskName,
                  r.bestMatch,
                  `${Math.round((r.similarity ?? 0) * 100)}%`,
                  r.developer,
                  r.note ?? "",
                ])
              )}

              <h2>Missing Tasks</h2>
              ${toHtmlTable(["Task ID", "Task Name", "Reason"], filteredMissing.map((m) => [m.taskId, m.taskName, m.reason]))}

              <h2>Extra Code</h2>
              ${toHtmlTable(["ID", "File", "Symbol", "Developer", "Reason"], filteredExtra.map((e) => [e.id, e.file, e.symbol, e.developer, e.reason]))}
            `;
            exportToHtml("covadev_report.html", "COVADEV Report", body);
          }}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 800 }}
        >
          Export Full HTML
        </button>

        <button
          onClick={() => selectedProjectId && loadReport(selectedProjectId)}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 800 }}
        >
          Refresh from Backend
        </button>
      </div>

      {/* Traceability */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Task-level Traceability</h2>
          <InfoTip text="Maps each BPMN task to the most similar code element based on similarity score." />
        </div>

        <p style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
          Each BPMN task is mapped to the most similar code element with a similarity score.
        </p>

        {filteredTrace.length === 0 ? (
          <EmptyState title="No traceability results" description="Try clearing filters/search, or run analysis first." />
        ) : (
          <DataTable<TraceRow>
            rows={filteredTrace}
            columns={[
              {
                header: "BPMN Task",
                width: "28%",
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 800 }}>{r.taskName}</div>
                    <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{r.taskId}</div>
                  </div>
                ),
              },
              {
                header: "Best Matching Code",
                width: "34%",
                render: (r) => <span style={{ fontFamily: "monospace", fontSize: 13 }}>{r.bestMatch}</span>,
              },
              { header: "Similarity", width: "12%", render: (r) => badge(r.similarity ?? 0) },
              {
                header: "Developer",
                width: "12%",
                render: (r) => <span style={{ fontWeight: 700 }}>{r.developer}</span>,
              },
              { header: "Notes", render: (r) => <span style={{ color: "#555" }}>{r.note ?? "-"}</span> },
            ]}
          />
        )}
      </div>

      {/* Missing Tasks */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Missing Tasks</h2>
          <InfoTip text="Tasks present in BPMN but not matched to code above the threshold." />
        </div>

        <p style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
          BPMN tasks with no confident code match (below threshold or not implemented).
        </p>

        {filteredMissing.length === 0 ? (
          <EmptyState title="No missing tasks" description="Great! All BPMN tasks are matched (with current threshold)." />
        ) : (
          <DataTable<MissingTask>
            rows={filteredMissing}
            columns={[
              {
                header: "Task",
                width: "40%",
                render: (m) => (
                  <div>
                    <div style={{ fontWeight: 800 }}>{m.taskName}</div>
                    <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{m.taskId}</div>
                  </div>
                ),
              },
              { header: "Reason", render: (m) => <span style={{ color: "#555" }}>{m.reason}</span> },
            ]}
          />
        )}
      </div>

      {/* Extra Code */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Extra Code</h2>
          <InfoTip text="Code elements that don’t map to any BPMN task (potential over-implementation)." />
        </div>

        <p style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
          Code elements that do not map to any BPMN task (potential over-implementation).
        </p>

        {filteredExtra.length === 0 ? (
          <EmptyState title="No extra code detected" description="No unmapped code elements found." />
        ) : (
          <DataTable<ExtraCode>
            rows={filteredExtra}
            columns={[
              { header: "ID", width: 80, render: (e) => <span style={{ fontWeight: 800 }}>{e.id}</span> },
              {
                header: "File / Symbol",
                width: "44%",
                render: (e) => (
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: 13 }}>{e.file}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 13, color: "#555", marginTop: 3 }}>
                      {e.symbol}
                    </div>
                  </div>
                ),
              },
              {
                header: "Developer",
                width: "14%",
                render: (e) => <span style={{ fontWeight: 700 }}>{e.developer}</span>,
              },
              { header: "Reason", render: (e) => <span style={{ color: "#555" }}>{e.reason}</span> },
            ]}
          />
        )}
      </div>
    </div>
  );
}