// frontend/src/pages/ProjectCreatePage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusMessage from "../components/StatusMessage";
import { createProject } from "../api/projects";

type State = "idle" | "saving" | "error";

export default function ProjectCreatePage() {
  const nav = useNavigate();
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [threshold, setThreshold] = useState("0.6");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setState("saving");
      setError("");
      const created = await createProject({
        name,
        description,
        similarity_threshold: Number(threshold),
      });
      nav(`/projects/${created.id}`);
    } catch (err: any) {
      setState("error");
      setError(err?.message ?? "Failed to create project");
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ marginTop: 0 }}>Create Project</h1>

      {state === "error" ? <StatusMessage title="Create failed" message={error} /> : null}

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ color: "#555" }}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>

        <div>
          <label style={{ color: "#555" }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", minHeight: 90 }}
          />
        </div>

        <div>
          <label style={{ color: "#555" }}>Similarity threshold (0–1)</label>
          <input
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>

        <button
          type="submit"
          disabled={state === "saving"}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          {state === "saving" ? "Creating..." : "Create"}
        </button>
      </form>
    </div>
  );
}
