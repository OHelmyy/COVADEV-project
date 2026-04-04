import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusMessage from "../components/StatusMessage";
import { fetchProjects } from "../api/projects";
import type { ProjectSummaryApi } from "../api/types";
import { useAuth } from "../app/auth";
import { buttonBase, cardBase, ui } from "../theme/ui";

type LoadState = "idle" | "loading" | "success" | "error";

export default function ProjectsPage() {
  const [state, setState] = useState<LoadState>("idle");
  const [rows, setRows] = useState<ProjectSummaryApi[]>([]);
  const [errorText, setErrorText] = useState("");

  const { user } = useAuth();

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
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          ...cardBase,
          padding: 20,
          background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          {user?.role === "ADMIN" ? (
            <h1 style={{ margin: 0 }}>All Projects</h1>
          ) : (
            <h1 style={{ margin: 0 }}>Your Projects</h1>
          )}

          <div style={{ marginTop: 8, opacity: 0.96 }}>
            Manage and access COVADEV project workspaces.
          </div>
        </div>

        {user?.role === "ADMIN" ? (
          <Link to="/projects/create" style={{ textDecoration: "none" }}>
            <button
              style={{
                ...buttonBase,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "#fff",
                color: ui.colors.primary,
                fontWeight: 900,
              }}
            >
              + Create Project
            </button>
          </Link>
        ) : null}
      </div>

      {state === "loading" || state === "idle" ? (
        <StatusMessage title="Loading projects..." />
      ) : null}

      {state === "error" ? (
        <StatusMessage title="Failed to load projects" message={errorText} onRetry={load} />
      ) : null}

      {state === "success" ? (
        <div style={{ ...cardBase, overflow: "hidden" }}>
          {rows.length === 0 ? (
            <div style={{ padding: 20, color: ui.colors.textMuted }}>No projects yet.</div>
          ) : (
            rows.map((p, index) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "18px 18px",
                  borderBottom: index !== rows.length - 1 ? `1px solid ${ui.colors.border}` : "none",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ fontWeight: 900, color: ui.colors.text, fontSize: 18 }}>{p.name}</div>
                  <div style={{ color: ui.colors.textSoft, marginTop: 6, lineHeight: 1.6 }}>
                    {p.description || "No description"}
                  </div>
                </div>

                <Link to={`/projects/${p.id}`} style={{ textDecoration: "none" }}>
                  <button
                    style={{
                      ...buttonBase,
                      border: `1px solid ${ui.colors.borderStrong}`,
                      background: "#fff",
                      color: ui.colors.text,
                    }}
                  >
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