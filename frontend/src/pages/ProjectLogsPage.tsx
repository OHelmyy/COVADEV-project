import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusMessage from "../components/StatusMessage";
import { fetchLogs, fetchProjectDetail } from "../api/projects";
import type { ProjectDetailApi } from "../api/types";
import { buttonBase, cardBase, ui } from "../theme/ui";

type LoadState = "idle" | "loading" | "success" | "error";

export default function ProjectLogsPage() {
  const { projectId } = useParams();
  const id = useMemo(() => Number(projectId), [projectId]);

  const [state, setState] = useState<LoadState>("idle");
  const [detail, setDetail] = useState<ProjectDetailApi | null>(null);

  const [logs, setLogs] = useState<any[]>([]);
  const [errorText, setErrorText] = useState("");

  async function load() {
    try {
      setState("loading");
      setErrorText("");

      const d = await fetchProjectDetail(id);
      setDetail(d);

      const l: any = await fetchLogs(id);
      setLogs(l.logs || []);

      setState("success");
    } catch (e: any) {
      setState("error");
      setErrorText(e?.message ?? "Failed to load logs");
    }
  }

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    load();
  }, [id]);

  if (state === "loading" || state === "idle") {
    return <StatusMessage title="Loading..." />;
  }

  if (state === "error") {
    return <StatusMessage title="Failed" message={errorText} onRetry={load} />;
  }

  if (!detail) return null;

  const isEvaluator = detail.membership.role === "EVALUATOR";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          ...cardBase,
          padding: 18,
          background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
          color: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>Upload Logs</h2>
        <div style={{ opacity: 0.96 }}>
          Project: <b>{detail.project.name}</b>
        </div>
      </div>

      {!isEvaluator ? (
        <StatusMessage title="Forbidden" message="Only evaluator can view upload logs." />
      ) : (
        <div style={{ ...cardBase, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>File Upload History</h3>

          {logs.length === 0 ? (
            <div style={{ color: ui.colors.textMuted, marginTop: 10 }}>No uploads yet.</div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: ui.colors.bgSoft }}>
                    <th style={{ textAlign: "left", padding: 12 }}>Type</th>
                    <th style={{ textAlign: "left", padding: 12 }}>File Name</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Uploaded By</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Uploaded At</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((f) => (
                    <tr key={f.id}>
                      <td style={{ padding: 12, fontWeight: 800, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {f.fileType}
                      </td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {f.originalName}
                      </td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {f.uploadedBy ?? "Unknown"}
                      </td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${ui.colors.border}` }}>
                        {f.createdAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Link to={`/projects/${id}`} style={{ textDecoration: "none", alignSelf: "flex-start" }}>
        <button
          style={{
            ...buttonBase,
            border: `1px solid ${ui.colors.borderStrong}`,
            background: "#fff",
            color: ui.colors.text,
          }}
        >
          ← Back to Project
        </button>
      </Link>
    </div>
  );
}