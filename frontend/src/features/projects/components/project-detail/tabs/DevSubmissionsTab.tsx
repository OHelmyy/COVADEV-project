import { useEffect, useState } from "react";
import {
  fetchDevSubmissions,
  acceptSubmission,
  rejectSubmission,
  reassignSubmission,
  type DevSubmission,
} from "../../../../../api/projects";
import { Card } from "../ProjectUi";

type Props = { projectId: number };

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING:    { bg: "#fff8e1", fg: "#8a5a00" },
  ACCEPTED:   { bg: "#eef5e0", fg: "#2d6a0f" },
  REJECTED:   { bg: "#ffecec", fg: "#a00000" },
  REASSIGNED: { bg: "#f0ecff", fg: "#4a1fa8" },
};

export default function DevSubmissionsTab({ projectId }: Props) {
  const [submissions, setSubmissions] = useState<DevSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [actionMsg, setActionMsg] = useState<Record<number, string>>({});

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await fetchDevSubmissions(projectId);
      setSubmissions(res.submissions);
    } catch (e: any) {
      setError(e.message || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

async function doAccept(sub: DevSubmission) {
    setActing(sub.id);
    setActionMsg((p) => ({ ...p, [sub.id]: "" }));
    try {
      const res = await acceptSubmission(projectId, sub.id);
      if ((res as any).belowThreshold) {
        setActionMsg((p) => ({
          ...p,
          [sub.id]: `⚠️ Score too low (${(res as any).similarity} / threshold ${(res as any).threshold}). Submission stays Pending — please reject or reassign with feedback.`,
        }));
      } else {
        setActionMsg((p) => ({ ...p, [sub.id]: "✓ Accepted and matched." }));
      }
      load();
    } catch (e: any) {
      setActionMsg((p) => ({ ...p, [sub.id]: `Error: ${e.message}` }));
    } finally {
      setActing(null);
    }
  }

  async function doReject(sub: DevSubmission) {
    setActing(sub.id);
    setActionMsg((p) => ({ ...p, [sub.id]: "" }));
    try {
      await rejectSubmission(projectId, sub.id, feedback[sub.id] || "");
      setActionMsg((p) => ({ ...p, [sub.id]: "✓ Submission rejected." }));
      load();
    } catch (e: any) {
      setActionMsg((p) => ({ ...p, [sub.id]: `Error: ${e.message}` }));
    } finally {
      setActing(null);
    }
  }

  async function doReassign(sub: DevSubmission) {
    setActing(sub.id);
    setActionMsg((p) => ({ ...p, [sub.id]: "" }));
    try {
      await reassignSubmission(projectId, sub.id, feedback[sub.id] || "");
      setActionMsg((p) => ({ ...p, [sub.id]: "✓ Reassigned with feedback." }));
      load();
    } catch (e: any) {
      setActionMsg((p) => ({ ...p, [sub.id]: `Error: ${e.message}` }));
    } finally {
      setActing(null);
    }
  }

  if (loading) return <Card><div style={{ color: "#888" }}>Loading submissions…</div></Card>;
  if (error)   return <Card><div style={{ color: "#a00" }}>{error}</div></Card>;

  const pending = submissions.filter((s) => s.status === "PENDING");
  const reviewed = submissions.filter((s) => s.status !== "PENDING");

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Developer Submissions</h3>
        <button
          onClick={load}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontSize: 13 }}
        >
          Refresh
        </button>
      </div>

      {submissions.length === 0 ? (
        <div style={{ color: "#888" }}>No developer submissions yet.</div>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Pending Review ({pending.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                {pending.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    acting={acting}
                    feedbackVal={feedback[sub.id] || ""}
                    onFeedbackChange={(v) => setFeedback((p) => ({ ...p, [sub.id]: v }))}
                    onAccept={() => doAccept(sub)}
                    onReject={() => doReject(sub)}
                    onReassign={() => doReassign(sub)}
                    actionMsg={actionMsg[sub.id] || ""}
                  />
                ))}
              </div>
            </>
          )}

          {reviewed.length > 0 && (
            <>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Reviewed ({reviewed.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {reviewed.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    acting={acting}
                    feedbackVal={feedback[sub.id] || ""}
                    onFeedbackChange={(v) => setFeedback((p) => ({ ...p, [sub.id]: v }))}
                    onAccept={() => doAccept(sub)}
                    onReject={() => doReject(sub)}
                    onReassign={() => doReassign(sub)}
                    actionMsg={actionMsg[sub.id] || ""}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}

function SubmissionCard({
   sub, acting, feedbackVal, onFeedbackChange, onAccept, onReject, onReassign, actionMsg,
}: {
  sub: DevSubmission;
  acting: number | null;
  feedbackVal: string;
  onFeedbackChange: (v: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onReassign: () => void;
  actionMsg: string;
}) {
  const colors = STATUS_COLORS[sub.status] ?? STATUS_COLORS.PENDING;
  const isPending = sub.status === "PENDING";
  const isAccepted = sub.status === "ACCEPTED";
  const busy = acting === sub.id;

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", background: "#fafafa" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{sub.taskName}</div>
          <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
            Task: {sub.taskId} · Developer: {sub.developerEmail} · Attempt #{sub.attemptNumber}
          </div>
          <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>
            Submitted: {new Date(sub.submittedAt).toLocaleString()}
          </div>
          {sub.zipFileName && (
            <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>File: {sub.zipFileName}</div>
          )}
        </div>
        <span style={{ background: colors.bg, color: colors.fg, fontWeight: 700, fontSize: 12, padding: "4px 12px", borderRadius: 20 }}>
          {sub.status}
        </span>
      </div>
      {sub.zipUrl ? (
        <div style={{ marginTop: 8 }}>
          <a
            href={sub.zipUrl}
            download
            style={{ fontSize: 13, color: "#0ea5e9", fontWeight: 600, textDecoration: "none" }}
          >
            ⬇ Download ZIP ({sub.zipFileName || "submission.zip"})
          </a>
        </div>
      ) : null}

      {sub.feedback && (
        <div style={{ marginTop: 10, background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
          <strong>Feedback:</strong> {sub.feedback}
        </div>
      )}

      {isPending && (
        <div style={{ marginTop: 12 }}>
          <textarea
            placeholder="Feedback (required for Reject / Reassign, optional for Accept)"
            value={feedbackVal}
            onChange={(e) => onFeedbackChange(e.target.value)}
            rows={2}
            style={{ width: "100%", borderRadius: 8, border: "1px solid #ddd", padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <button onClick={onAccept} disabled={busy} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {busy ? "…" : "Accept"}
            </button>
            <button onClick={onReassign} disabled={busy} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#6c47ff", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {busy ? "…" : "Reassign"}
            </button>
            <button onClick={onReject} disabled={busy} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {busy ? "…" : "Reject"}
            </button>
          </div>
        </div>
      )}

      {isAccepted && (
        <div style={{ marginTop: 12 }}>
          <textarea
            placeholder="Feedback for developer (required)"
            value={feedbackVal}
            onChange={(e) => onFeedbackChange(e.target.value)}
            rows={2}
            style={{ width: "100%", borderRadius: 8, border: "1px solid #ddd", padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
          />
          <button onClick={onReassign} disabled={busy} style={{ marginTop: 8, padding: "8px 18px", borderRadius: 8, border: "none", background: "#6c47ff", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            {busy ? "…" : "Reassign"}
          </button>
        </div>
      )}

      {actionMsg && (
        <div style={{ marginTop: 8, fontSize: 13, color: actionMsg.startsWith("Error") ? "#a00" : "#2d6a0f", fontWeight: 600 }}>
          {actionMsg}
        </div>
      )}
    </div>
  );
}