import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusMessage from "../components/StatusMessage";
import { createProject } from "../api/projects";
import { adminListUsers, type AdminUser } from "../api/adminUsers";
import { buttonBase, cardBase, inputBase, ui } from "../theme/ui";

type State = "idle" | "loadingUsers" | "saving" | "error";

export default function ProjectCreatePage() {
  const nav = useNavigate();

  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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
        similarity_threshold: 0.6,
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
    <div style={{ minHeight: "100vh", padding: "40px 20px", display: "flex", justifyContent: "center", background: "radial-gradient(circle at top right, rgba(6,182,212,0.07), transparent 22%), radial-gradient(circle at top left, rgba(109,40,217,0.05), transparent 18%), #f4f7fb" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%", maxWidth: 880 }}>
      <div
        style={{
          ...cardBase,
          padding: 20,
          background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
          color: "#fff",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Create Project</h1>
        <div style={{ opacity: 0.96, maxWidth: 760, lineHeight: 1.7 }}>
          Configure a new COVADEV workspace, assign its evaluator, and choose the participating developers.
        </div>
      </div>

      {state === "error" ? <StatusMessage title="Create failed" message={error} /> : null}
      {state === "loadingUsers" ? (
        <StatusMessage title="Loading users..." message="Fetching evaluators & developers..." />
      ) : null}

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...cardBase, padding: 18 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Project Information</h3>

          <div style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: ui.colors.textSoft, fontWeight: 700 }}>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ ...inputBase, width: "100%" }}
                placeholder="Enter project name"
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: ui.colors.textSoft, fontWeight: 700 }}>Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  ...inputBase,
                  width: "100%",
                  minHeight: 110,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                placeholder="Enter project description"
              />
            </label>
          </div>
        </div>

        <div style={{ ...cardBase, padding: 18 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Project Assignment</h3>

          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ color: ui.colors.textSoft, fontWeight: 700 }}>Evaluator</label>
              <select
                value={evaluatorId}
                onChange={(e) => setEvaluatorId(e.target.value ? Number(e.target.value) : "")}
                required
                style={{
                  ...inputBase,
                  width: "100%",
                  background: "#fff",
                  marginTop: 6,
                }}
              >
                <option value="">Select evaluator...</option>
                {evaluators.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName ? `${u.fullName} — ${u.email}` : u.email}
                  </option>
                ))}
              </select>

              {evaluators.length === 0 ? (
                <div style={{ marginTop: 8, fontSize: 12, color: ui.colors.textMuted }}>
                  No active evaluators found. Create evaluator users first from Admin → Users.
                </div>
              ) : null}
            </div>

            <div
              style={{
                border: `1px solid ${ui.colors.border}`,
                borderRadius: ui.radius.lg,
                padding: 14,
                background: ui.colors.bgSoft,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 10, color: ui.colors.text }}>
                Developers
              </div>

              {developers.length === 0 ? (
                <div style={{ fontSize: 13, color: ui.colors.textMuted }}>
                  No active developers found. Create developer users first from Admin → Users.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {developers.map((u) => {
                    const checked = developerIds.includes(u.id);
                    const disabled = evaluatorId === u.id;

                    return (
                      <label
                        key={u.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          opacity: disabled ? 0.5 : 1,
                          cursor: disabled ? "not-allowed" : "pointer",
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: checked ? "#ffffff" : "transparent",
                          border: `1px solid ${checked ? "#bfdbfe" : "transparent"}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleDev(u.id)}
                        />
                        <span>{u.fullName ? `${u.fullName} — ${u.email}` : u.email}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 12, color: ui.colors.textMuted }}>
                Selected: <b>{developerIds.length}</b>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={state === "saving" || state === "loadingUsers"}
            style={{
              ...buttonBase,
              border: "1px solid transparent",
              background: ui.colors.primary,
              color: "#fff",
              minWidth: 150,
              fontWeight: 800,
            }}
          >
            {state === "saving" ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}