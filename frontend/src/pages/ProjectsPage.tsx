// frontend/src/pages/ProjectsPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusMessage from "../components/StatusMessage";
import { fetchProjects } from "../api/projects";
import type { ProjectSummaryApi } from "../api/types";


type LoadState = "idle" | "loading" | "success" | "error";

export default function ProjectsPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [rows, setRows] = useState<ProjectSummaryApi[]>([]);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end" }}>
        <div>
          <h1 style={{ margin: 0 }}>Your Projects</h1>
          <p style={{ marginTop: 6, color: "#555" }}>Only projects you are a member of.</p>
        </div>
        <Link to="/projects/create" style={{ textDecoration: "none" }}>
          <button style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
            + Create Project
          </button>
        </Link>
      </div>

      {state === "loading" || state === "idle" ? <StatusMessage title="Loading projects..." /> : null}

      {state === "error" ? (
        <StatusMessage title="Failed to load projects" message={errorText} onRetry={load} />
      ) : null}

      {state === "success" ? (
        <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
          {rows.length === 0 ? (
            <div style={{ padding: 16, color: "#777" }}>No projects yet. Create one.</div>
          ) : (
            rows.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderBottom: "1px solid #f3f3f3",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{p.name}</div>
                  <div style={{ color: "#666", marginTop: 4 }}>{p.description || "No description"}</div>
                  <div style={{ color: "#888", marginTop: 6, fontSize: 13 }}>
                    Role: <b>{p.membership?.role ?? "—"}</b> • Threshold: <b>{p.similarityThreshold}</b>
                  </div>
                </div>

                <Link to={`/projects/${p.id}`} style={{ textDecoration: "none" }}>
                  <button style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
                    Open
                  </button>
                </Link>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
