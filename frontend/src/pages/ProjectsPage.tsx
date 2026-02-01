import { useEffect, useState } from "react";
import StatusMessage from "../components/StatusMessage";
import { fetchProjects } from "../api/projects";
import type { ProjectSummary } from "../api/types";


type LoadState = "idle" | "loading" | "success" | "error";

export default function ProjectsPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [rows, setRows] = useState<ProjectSummary[]>([]);
  const [errorText, setErrorText] = useState("");

  async function load() {
    try {
      setState("loading");
      setErrorText("");
      const res = await fetchProjects();
      setRows(res);
      setState("success");
    } catch (e: any) {
      setState("error");
      setErrorText(e?.message ?? "Failed to load projects");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0 }}>Projects</h1>
        <p style={{ marginTop: 6, color: "#555" }}>Projects list (from backend).</p>
      </div>

      {state === "loading" || state === "idle" ? (
        <StatusMessage title="Loading projects..." />
      ) : null}

      {state === "error" ? (
        <StatusMessage
          title="Failed to load projects"
          message={`${errorText}. Check endpoint: /api/projects/`}
          onRetry={load}
        />
      ) : null}

      {state === "success" ? (
        <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
          {rows.length === 0 ? (
            <div style={{ padding: 16, color: "#777" }}>No projects found.</div>
          ) : (
            rows.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderBottom: "1px solid #f3f3f3",
                }}
              >
                <div style={{ fontWeight: 800 }}>{p.name}</div>
                <div style={{ color: p.status === "done" ? "#094780" : "#8a5a00", fontWeight: 800 }}>
                  {p.status}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
