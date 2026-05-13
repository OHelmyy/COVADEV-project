import { useEffect, useRef, useState } from "react";
import { fetchMyTasks, submitZip, type MyTask } from "../../../../../api/projects";
import { Card } from "../ProjectUi";

type Props = { projectId: number };

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING:    { bg: "#fff8e1", fg: "#8a5a00" },
  ACCEPTED:   { bg: "#eef5e0", fg: "#2d6a0f" },
  REJECTED:   { bg: "#ffecec", fg: "#a00000" },
  REASSIGNED: { bg: "#f0ecff", fg: "#4a1fa8" },
};

export default function MyTasksTab({ projectId }: Props) {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<number | null>(null); // assignmentId
  const [uploadMsg, setUploadMsg] = useState<Record<number, string>>({});
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await fetchMyTasks(projectId);
      setTasks(res.tasks);
    } catch (e: any) {
      setError(e.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  async function handleFileChange(assignmentId: number, file: File) {
    setUploading(assignmentId);
    setUploadMsg((prev) => ({ ...prev, [assignmentId]: "" }));
    try {
      await submitZip(projectId, assignmentId, file);
      setUploadMsg((prev) => ({ ...prev, [assignmentId]: "✓ Submitted! Waiting for evaluator review." }));
      load();
    } catch (e: any) {
      setUploadMsg((prev) => ({ ...prev, [assignmentId]: `Error: ${e.message}` }));
    } finally {
      setUploading(null);
      if (fileRefs.current[assignmentId]) fileRefs.current[assignmentId]!.value = "";
    }
  }

  if (loading) return <Card><div style={{ color: "#888" }}>Loading your tasks…</div></Card>;
  if (error)   return <Card><div style={{ color: "#a00" }}>{error}</div></Card>;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>My Assigned Tasks</h3>
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontSize: 13 }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {tasks.length === 0 ? (
        <div style={{ color: "#888" }}>No tasks assigned to you yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {tasks.map((t) => {
            const sub = t.submission;            const statusColors = sub ? (STATUS_COLORS[sub.status] ?? STATUS_COLORS.PENDING) : null;
            const canUpload = !sub || sub.status === "REJECTED" || sub.status === "REASSIGNED";

            return (
              <div key={t.assignmentId} style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "14px 16px",
                background: "#fff",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{t.taskName}</div>
                    <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>{t.taskId}</div>
                    {t.taskDescription ? (
                      <div style={{ color: "#444", fontSize: 13, marginTop: 6 }}>{t.taskDescription}</div>
                    ) : null}
                  </div>

                  {sub && statusColors ? (
                    <span style={{
                      background: statusColors.bg,
                      color: statusColors.fg,
                      fontWeight: 700,
                      fontSize: 12,
                      padding: "4px 12px",
                      borderRadius: 20,
                    }}>{sub.status}</span>
                  ) : (
                    <span style={{ background: "#f3f4f6", color: "#888", fontWeight: 600, fontSize: 12, padding: "4px 12px", borderRadius: 20 }}>
                      NOT SUBMITTED
                    </span>
                  )}
                </div>

                {sub?.feedback ? (
                  <div style={{ marginTop: 10, background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                    <strong>Evaluator feedback:</strong> {sub.feedback}
                  </div>
                ) : null}

                {canUpload ? (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="file"
                      accept=".zip"
                      ref={(el) => { fileRefs.current[t.assignmentId] = el; }}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileChange(t.assignmentId, f);
                      }}
                    />
                    <button
                      onClick={() => fileRefs.current[t.assignmentId]?.click()}
                      disabled={uploading === t.assignmentId}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 8,
                        border: "none",
                        background: "#6c47ff",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      {uploading === t.assignmentId ? "Uploading…" : sub ? "Re-submit ZIP" : "Upload ZIP"}
                    </button>
                    {uploadMsg[t.assignmentId] ? (
                      <span style={{ fontSize: 13, color: uploadMsg[t.assignmentId].startsWith("Error") ? "#a00" : "#2d6a0f" }}>
                        {uploadMsg[t.assignmentId]}
                      </span>
                    ) : null}
                  </div>
                ) : sub?.status === "PENDING" ? (
                  <div style={{ marginTop: 10, color: "#666", fontSize: 13 }}>
                    Submission is under review by the evaluator.
                  </div>
                ) : sub?.status === "ACCEPTED" ? (
                  <div style={{ marginTop: 10, color: "#2d6a0f", fontSize: 13, fontWeight: 600 }}>
                    ✓ Your submission was accepted and processed.
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}