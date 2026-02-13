// frontend/src/pages/ProjectLogsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusMessage from "../components/StatusMessage";
import { fetchLogs, fetchProjectDetail } from "../api/projects";
import type { ProjectDetailApi } from "../api/types";


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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (state === "loading" || state === "idle") return <StatusMessage title="Loading..." />;
  if (state === "error") return <StatusMessage title="Failed" message={errorText} onRetry={load} />;
  if (!detail) return null;

  const isEvaluator = detail.membership.role === "EVALUATOR";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Upload Logs</h2>
        <div style={{ color: "#666" }}>
          Project: <b>{detail.project.name}</b>
        </div>
      </div>

      {!isEvaluator ? (
        <StatusMessage title="Forbidden" message="Only evaluator can view upload logs." />
      ) : (
        <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>File Upload History</h3>

          {logs.length === 0 ? (
            <div style={{ color: "#777", marginTop: 10 }}>No uploads yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <th style={{ textAlign: "left", padding: 8 }}>Type</th>
                  <th style={{ textAlign: "left", padding: 8 }}>File Name</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Uploaded By</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Uploaded At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                    <td style={{ padding: 8, fontWeight: 700 }}>{f.fileType}</td>
                    <td style={{ padding: 8 }}>{f.originalName}</td>
                    <td style={{ padding: 8 }}>{f.uploadedBy ?? "Unknown"}</td>
                    <td style={{ padding: 8 }}>{f.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Link to={`/projects/${id}`} style={{ textDecoration: "none" }}>
        <button style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
          ← Back to Project
        </button>
      </Link>
    </div>
  );
}
