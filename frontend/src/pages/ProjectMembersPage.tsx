// frontend/src/pages/ProjectMembersPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusMessage from "../components/StatusMessage";
import { addMember, fetchProjectDetail, removeMember } from "../api/projects";
import type { ProjectDetailApi } from "../api/types";



type LoadState = "idle" | "loading" | "success" | "error";

export default function ProjectMembersPage() {
  const { projectId } = useParams();
  const id = useMemo(() => Number(projectId), [projectId]);

  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<ProjectDetailApi | null>(null);

  const [errorText, setErrorText] = useState("");

  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      setState("loading");
      setErrorText("");
      const res = await fetchProjectDetail(id);
      setData(res);
      setState("success");
    } catch (e: any) {
      setState("error");
      setErrorText(e?.message ?? "Failed to load members");
    }
  }

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onAdd() {
    setMsg("Adding...");
    try {
      await addMember(id, email);
      setEmail("");
      setMsg("Developer added ✅");
      await load();
    } catch (e: any) {
      setMsg(`Add failed: ${e?.message ?? e}`);
    }
  }

  async function onRemove(membershipId: number) {
    setMsg("Removing...");
    try {
      await removeMember(id, membershipId);
      setMsg("Removed ✅");
      await load();
    } catch (e: any) {
      setMsg(`Remove failed: ${e?.message ?? e}`);
    }
  }

  if (state === "loading" || state === "idle") return <StatusMessage title="Loading..." />;
  if (state === "error") return <StatusMessage title="Failed" message={errorText} onRetry={load} />;
  if (!data) return null;

  const isEvaluator = data.membership.role === "EVALUATOR";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Manage Members — {data.project.name}</h2>
        <p style={{ color: "#666", marginBottom: 0 }}>
          Add developers by email. Users can be developer here and evaluator in another project.
        </p>
      </div>

      {!isEvaluator ? (
        <StatusMessage title="Forbidden" message="Only the evaluator can manage project members." />
      ) : (
        <>
          {msg ? (
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fff" }}>{msg}</div>
          ) : null}

          <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
            <h3 style={{ marginTop: 0 }}>Add Developer</h3>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@email.com"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
            <button
              onClick={onAdd}
              style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            >
              Add
            </button>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
            <h3 style={{ marginTop: 0 }}>Current Members</h3>

            {data.members.map((m: ProjectDetailApi["members"][number]) => (

              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid #eee",
                  paddingTop: 10,
                  marginTop: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{m.username}</div>
                  <div style={{ color: "#666" }}>{m.role}</div>
                </div>

                {m.role !== "EVALUATOR" ? (
                  <button
                    onClick={() => onRemove(m.id)}
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}

      <Link to={`/projects/${id}`} style={{ textDecoration: "none" }}>
        <button style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>Back</button>
      </Link>
    </div>
  );
}
