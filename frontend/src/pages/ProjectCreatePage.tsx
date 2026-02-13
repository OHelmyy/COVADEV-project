// frontend/src/pages/ProjectCreatePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusMessage from "../components/StatusMessage";
import { createProject } from "../api/projects";
import { adminListUsers, type AdminUser } from "../api/adminUsers";

type State = "idle" | "loadingUsers" | "saving" | "error";

export default function ProjectCreatePage() {
  const nav = useNavigate();

  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [threshold, setThreshold] = useState("0.6");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [evaluatorId, setEvaluatorId] = useState<number | "">("");
  const [developerIds, setDeveloperIds] = useState<number[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setState("loadingUsers");
        setError("");
        const res = await adminListUsers();
        setUsers(res.users || []);
        setState("idle");
      } catch (e: any) {
        setState("error");
        setError(e?.message ?? "Failed to load users");
      }
    })();
  }, []);

  const evaluators = useMemo(
    () => users.filter((u) => String(u.role).toUpperCase() === "EVALUATOR" && u.isActive),
    [users]
  );

  const developers = useMemo(
    () => users.filter((u) => String(u.role).toUpperCase() === "DEVELOPER" && u.isActive),
    [users]
  );

  function toggleDev(id: number) {
    setDeveloperIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!evaluatorId) {
      setState("error");
      setError("Please select an evaluator.");
      return;
    }

    const evaluator = users.find((u) => u.id === evaluatorId);
    if (!evaluator?.email) {
      setState("error");
      setError("Selected evaluator is invalid.");
      return;
    }

    const devEmails = developerIds
      .map((id) => users.find((u) => u.id === id)?.email)
      .filter(Boolean)
      .join(",");

    try {
      setState("saving");

      const created = await createProject({
        name,
        description,
        similarity_threshold: Number(threshold),

        // ✅ backend expects these:
        evaluatorEmail: evaluator.email.trim().toLowerCase(),
        developerEmails: devEmails,
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
      {state === "loadingUsers" ? <StatusMessage title="Loading users..." message="Fetching evaluators & developers..." /> : null}

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

        {/* Evaluator dropdown */}
        <div>
          <label style={{ color: "#555" }}>Evaluator</label>
          <select
            value={evaluatorId}
            onChange={(e) => setEvaluatorId(e.target.value ? Number(e.target.value) : "")}
            required
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
          >
            <option value="">Select evaluator...</option>
            {evaluators.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName ? `${u.fullName} — ${u.email}` : u.email}
              </option>
            ))}
          </select>

          {evaluators.length === 0 ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "#777" }}>
              No active evaluators found. Create evaluator users first from Admin → Users.
            </div>
          ) : null}
        </div>

        {/* Developers multi-select */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Developers</div>

          {developers.length === 0 ? (
            <div style={{ fontSize: 13, color: "#777" }}>
              No active developers found. Create developer users first from Admin → Users.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {developers.map((u) => {
                const checked = developerIds.includes(u.id);
                const disabled = evaluatorId === u.id; // just in case

                return (
                  <label
                    key={u.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      opacity: disabled ? 0.5 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleDev(u.id)} />
                    <span>{u.fullName ? `${u.fullName} — ${u.email}` : u.email}</span>
                  </label>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
            Selected: <b>{developerIds.length}</b>
          </div>
        </div>

        <button
          type="submit"
          disabled={state === "saving" || state === "loadingUsers"}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          {state === "saving" ? "Creating..." : "Create"}
        </button>
      </form>
    </div>
  );
}