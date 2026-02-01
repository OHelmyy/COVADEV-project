import React from "react";
import { useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import FilterBar from "../components/FilterBar";
import { exportToCsv, exportToHtml } from "../utils/exporters";
import InfoTip from "../components/InfoTip";
import EmptyState from "../components/EmptyState";

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

function toHtmlTable(headers: string[], rows: string[][]) {
  const thead = `<tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${r.map((c) => `<td>${String(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

export default function ReportsPage() {
  // ✅ Mock traceability results (later from API)
  const traceRows: TraceRow[] = [
    {
      taskId: "T01",
      taskName: "Validate user registration",
      bestMatch: "accounts/services.py → validate_registration()",
      similarity: 0.87,
      developer: "Serag",
      note: "Strong match by keywords + comments",
    },
    {
      taskId: "T02",
      taskName: "Upload BPMN file",
      bestMatch: "projects/views.py → upload_bpmn()",
      similarity: 0.82,
      developer: "Helmy",
    },
    {
      taskId: "T03",
      taskName: "Compute similarity scores",
      bestMatch: "analysis/semantic/similarity.py → cosine_similarity_matrix()",
      similarity: 0.66,
      developer: "Mostafa",
      note: "Below threshold (needs tuning)",
    },
  ];

  // ✅ Mock missing tasks
  const missingTasks: MissingTask[] = [
    { taskId: "T04", taskName: "Generate evaluation report", reason: "No code matched above threshold" },
    { taskId: "T05", taskName: "Export CSV results", reason: "Feature not implemented yet" },
  ];

  // ✅ Mock extra code
  const extraCode: ExtraCode[] = [
    {
      id: "E01",
      file: "analysis/utils.py",
      symbol: "debug_dump_all()",
      developer: "Mostafa",
      reason: "Unused helper (no BPMN task maps to it)",
    },
    {
      id: "E02",
      file: "projects/legacy_upload.py",
      symbol: "legacy_upload_zip()",
      developer: "Helmy",
      reason: "Legacy code path not used",
    },
  ];

  // Day 4 UI controls
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"similarity_desc" | "similarity_asc" | "task_az">("similarity_desc");
  const [lowOnly, setLowOnly] = useState(false);

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

  const normalizedSearch = search.trim().toLowerCase();

  const filteredTrace = useMemo(() => {
    let rows = [...traceRows];

    // filter low similarity
    if (lowOnly) rows = rows.filter((r) => r.similarity < 0.7);

    // search filter
    if (normalizedSearch.length > 0) {
      rows = rows.filter((r) => {
        const hay = `${r.taskId} ${r.taskName} ${r.bestMatch} ${r.developer} ${r.note ?? ""}`.toLowerCase();
        return hay.includes(normalizedSearch);
      });
    }

    // sorting
    if (sort === "similarity_desc") rows.sort((a, b) => b.similarity - a.similarity);
    if (sort === "similarity_asc") rows.sort((a, b) => a.similarity - b.similarity);
    if (sort === "task_az") rows.sort((a, b) => a.taskName.localeCompare(b.taskName));

    return rows;
  }, [lowOnly, normalizedSearch, sort]);

  const filteredMissing = useMemo(() => {
    if (!normalizedSearch) return missingTasks;
    return missingTasks.filter((m) =>
      `${m.taskId} ${m.taskName} ${m.reason}`.toLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch]);

  const filteredExtra = useMemo(() => {
    if (!normalizedSearch) return extraCode;
    return extraCode.filter((e) =>
      `${e.id} ${e.file} ${e.symbol} ${e.developer} ${e.reason}`.toLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0 }}>Reports</h1>
        <p style={{ marginTop: 6, color: "#555" }}>
          Traceability + Missing/Extra reports (mock data) with filtering, sorting, export, and UX polish.
        </p>
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
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
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
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
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
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          Export Extra CSV
        </button>

        <button
          onClick={() => {
            const body = `
              <h1>COVADEV Report Export</h1>
              <p>Generated from the Reports page (mock data for now).</p>

              <h2>Traceability</h2>
              ${toHtmlTable(
                ["Task ID", "Task Name", "Best Match", "Similarity", "Developer", "Note"],
                filteredTrace.map((r) => [
                  r.taskId,
                  r.taskName,
                  r.bestMatch,
                  `${Math.round(r.similarity * 100)}%`,
                  r.developer,
                  r.note ?? "",
                ])
              )}

              <h2>Missing Tasks</h2>
              ${toHtmlTable(
                ["Task ID", "Task Name", "Reason"],
                filteredMissing.map((m) => [m.taskId, m.taskName, m.reason])
              )}

              <h2>Extra Code</h2>
              ${toHtmlTable(
                ["ID", "File", "Symbol", "Developer", "Reason"],
                filteredExtra.map((e) => [e.id, e.file, e.symbol, e.developer, e.reason])
              )}
            `;
            exportToHtml("covadev_report.html", "COVADEV Report", body);
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          Export Full HTML
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
              { header: "Similarity", width: "12%", render: (r) => badge(r.similarity) },
              { header: "Developer", width: "12%", render: (r) => <span style={{ fontWeight: 700 }}>{r.developer}</span> },
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
              { header: "Developer", width: "14%", render: (e) => <span style={{ fontWeight: 700 }}>{e.developer}</span> },
              { header: "Reason", render: (e) => <span style={{ color: "#555" }}>{e.reason}</span> },
            ]}
          />
        )}
      </div>
    </div>
  );
}
