import { useEffect, useRef, useState } from "react";
import { submitZip } from "../../../../../api/projects";
import {
  getMyTaskAssignments,
  startTaskAssignment,
  submitTaskAssignment,
  previewScoreGithub,
  previewScoreZip,
  type PreviewScoreResult,
} from "../../../../task-management/api/taskManagementApi";
import type { AssignmentWithTask } from "../../../../task-management/types";
import { Card } from "../ProjectUi";
import { buttonBase, inputBase, ui } from "../../../../../theme/ui";
import { useToast } from "../../../../../components/Toast";

type Props = { projectId: number; githubRepoUrl?: string };

function buildBranchUrl(repoUrl: string | undefined, branch: string): string {
  if (!repoUrl) return `https://github.com`;
  // Strip trailing slash and .git, then append /tree/{branch}
  const base = repoUrl.replace(/\.git$/, "").replace(/\/$/, "");
  return `${base}/tree/${branch}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED:     "Assigned",
  IN_PROGRESS:  "In Progress",
  SUBMITTED:    "Submitted",
  UNDER_REVIEW: "Under Review",
  NEEDS_CHANGES:"Changes Requested",
  ACCEPTED:     "Accepted",
  REJECTED:     "Rejected",
  MERGED:       "Merged",
};

const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  ASSIGNED:     { bg: "#eff6ff", fg: "#1e40af", border: "#bfdbfe" },
  IN_PROGRESS:  { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
  SUBMITTED:    { bg: "#fef3c7", fg: "#92400e", border: "#fde68a" },
  UNDER_REVIEW: { bg: "#fef3c7", fg: "#92400e", border: "#fde68a" },
  NEEDS_CHANGES:{ bg: "#fff7ed", fg: "#c2410c", border: "#fdba74" },
  ACCEPTED:     { bg: "#ecfdf5", fg: "#065f46", border: "#6ee7b7" },
  REJECTED:     { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  MERGED:       { bg: "#ecfdf5", fg: "#065f46", border: "#6ee7b7" },
};

function relativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, background: "#fff" }}>
      {[120, 80, "100%", 60].map((w, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 18 : 13,
            width: w,
            borderRadius: 6,
            background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
            backgroundSize: "200% 100%",
            animation: "skeleton-shimmer 1.4s infinite",
            marginBottom: i < 3 ? 10 : 0,
          }}
        />
      ))}
      <style>{`@keyframes skeleton-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MyTasksTab({ projectId, githubRepoUrl }: Props) {
  const toast = useToast();

  const [tasks, setTasks]         = useState<AssignmentWithTask[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  // Submit state
  const [submitMethod, setSubmitMethod] = useState<Record<number, "github" | "zip">>({});
  const [prNumber,  setPrNumber]        = useState<Record<number, string>>({});
  const [subNote,   setSubNote]         = useState<Record<number, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Preview score state
  const [previewOpen,    setPreviewOpen]    = useState<Record<number, boolean>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<number, boolean>>({});
  const [previewResult,  setPreviewResult]  = useState<Record<number, PreviewScoreResult | null>>({});
  const [previewError,   setPreviewError]   = useState<Record<number, string>>({});

  // Collapse state — NEEDS_CHANGES starts expanded, others start collapsed
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const previewZipRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Scroll-to-NEEDS_CHANGES
  const needsChangesRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await getMyTaskAssignments();
      const filtered = (res.items || []).filter((item) => item.projectId === projectId);
      setTasks(filtered);
    } catch (e: any) {
      setError(e.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  // Auto-scroll to first NEEDS_CHANGES task after load
  useEffect(() => {
    if (!loading && needsChangesRef.current) {
      setTimeout(() => {
        needsChangesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [loading]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleStartTask(assignmentId: number) {
    setActionLoading((p) => ({ ...p, [assignmentId]: true }));
    try {
      await startTaskAssignment(assignmentId);
      toast.success("Task started — good luck!");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not start task.");
    } finally {
      setActionLoading((p) => ({ ...p, [assignmentId]: false }));
    }
  }

  async function handleGitHubSubmit(assignmentId: number) {
    const num = prNumber[assignmentId] ? Number(prNumber[assignmentId]) : null;
    if (!num) { toast.warning("Please enter the Pull Request number."); return; }

    setActionLoading((p) => ({ ...p, [assignmentId]: true }));
    try {
      await submitTaskAssignment(assignmentId, {
        githubPrNumber: num,
        githubPrUrl: "",
        submissionNotes: subNote[assignmentId] || "",
      });
      toast.success("Submitted via GitHub PR — awaiting review.");
      setPrNumber((p) => ({ ...p, [assignmentId]: "" }));
      setSubNote((p)  => ({ ...p, [assignmentId]: "" }));
      await load();
    } catch (e: any) {
      toast.error(e.message || "Submission failed.");
    } finally {
      setActionLoading((p) => ({ ...p, [assignmentId]: false }));
    }
  }

  async function handleZipSubmit(assignmentId: number, file: File) {
    setActionLoading((p) => ({ ...p, [assignmentId]: true }));
    try {
      await submitZip(projectId, assignmentId, file);
      toast.success("ZIP submitted — awaiting review.");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Upload failed.");
    } finally {
      setActionLoading((p) => ({ ...p, [assignmentId]: false }));
      if (fileRefs.current[assignmentId]) fileRefs.current[assignmentId]!.value = "";
    }
  }

  async function handlePreviewGithub(assignmentId: number) {
    setPreviewLoading((p) => ({ ...p, [assignmentId]: true }));
    setPreviewResult((p)  => ({ ...p, [assignmentId]: null }));
    setPreviewError((p)   => ({ ...p, [assignmentId]: "" }));
    try {
      const res = await previewScoreGithub(projectId, assignmentId);
      setPreviewResult((p) => ({ ...p, [assignmentId]: res }));
    } catch (e: any) {
      setPreviewError((p) => ({ ...p, [assignmentId]: e.message || "Preview failed." }));
    } finally {
      setPreviewLoading((p) => ({ ...p, [assignmentId]: false }));
    }
  }

  async function handlePreviewZip(assignmentId: number, file: File) {
    setPreviewLoading((p) => ({ ...p, [assignmentId]: true }));
    setPreviewResult((p)  => ({ ...p, [assignmentId]: null }));
    setPreviewError((p)   => ({ ...p, [assignmentId]: "" }));
    try {
      const res = await previewScoreZip(projectId, assignmentId, file);
      setPreviewResult((p) => ({ ...p, [assignmentId]: res }));
    } catch (e: any) {
      setPreviewError((p) => ({ ...p, [assignmentId]: e.message || "Preview failed." }));
    } finally {
      setPreviewLoading((p) => ({ ...p, [assignmentId]: false }));
      if (previewZipRefs.current[assignmentId]) previewZipRefs.current[assignmentId]!.value = "";
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[1, 2].map((k) => <SkeletonCard key={k} />)}
      </div>
    </Card>
  );

  if (error) return (
    <Card>
      <div style={{ padding: "32px 0", textAlign: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: ui.colors.dangerSoft, border: `2px solid #fca5a5`, margin: "0 auto 10px" }} />
        <div style={{ fontWeight: 700, color: ui.colors.danger, marginBottom: 8 }}>Failed to load your tasks</div>
        <div style={{ fontSize: 13, color: ui.colors.textMuted, marginBottom: 16 }}>{error}</div>
        <button onClick={load} style={{ ...buttonBase, padding: "8px 18px", background: ui.colors.primary, color: "#fff", fontWeight: 700 }}>
          Try again
        </button>
      </div>
    </Card>
  );

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, color: ui.colors.text }}>My Assigned Tasks</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: ui.colors.textMuted }}>
            Work on your branch, start tasks, and submit via GitHub PR or ZIP.
          </p>
        </div>
        <button
          onClick={load}
          style={{
            ...buttonBase,
            padding: "8px 14px",
            background: "#fff",
            border: `1px solid ${ui.colors.borderStrong}`,
            color: ui.colors.text,
            fontSize: 13,
          }}
        >
          Refresh
        </button>
      </div>

      {tasks.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: ui.colors.primarySoft, border: `2px solid ${ui.colors.border}`, margin: "0 auto 12px" }} />
          <div style={{ fontWeight: 700, fontSize: 15, color: ui.colors.text, marginBottom: 6 }}>
            No tasks assigned yet
          </div>
          <div style={{ fontSize: 13, color: ui.colors.textMuted }}>
            Your project admin will assign tasks to you. Check back soon.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {tasks.map((t) => {
            const sc = STATUS_COLORS[t.status] ?? { bg: "#f3f4f6", fg: "#6b7280", border: "#d1d5db" };
            const isNeedsChanges = t.status === "NEEDS_CHANGES";
            const canSubmit = ["IN_PROGRESS", "NEEDS_CHANGES"].includes(t.status);
            const activeMethod = submitMethod[t.assignmentId] || "github";
            const isCollapsed = collapsed[t.assignmentId] ?? (t.status !== "NEEDS_CHANGES");
            const isFirstNeedsChanges = isNeedsChanges && needsChangesRef.current === null;

            return (
              <div
                key={t.assignmentId}
                ref={isFirstNeedsChanges ? needsChangesRef : undefined}
                style={{
                  border: `1px solid ${isNeedsChanges ? "#fdba74" : ui.colors.border}`,
                  borderRadius: 14,
                  background: "#fff",
                  boxShadow: ui.shadow.sm,
                  overflow: "hidden",
                }}
              >
                {/* ── Clickable Header ── */}
                <div
                  onClick={() => setCollapsed(p => ({ ...p, [t.assignmentId]: !isCollapsed }))}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "15px 20px", cursor: "pointer",
                    background: isCollapsed ? "#fff" : ui.colors.bgSoft,
                    borderBottom: isCollapsed ? "none" : `1px solid ${ui.colors.border}`,
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: sc.fg, display: "inline-block", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: ui.colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.task.name}
                    </div>
                    <div style={{ fontSize: 11, color: ui.colors.textMuted, fontFamily: "monospace", marginTop: 2 }}>{t.task.taskId}</div>
                  </div>
                  {isNeedsChanges && <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>}
                  <span style={{ background: sc.bg, color: sc.fg, fontWeight: 700, fontSize: 11, padding: "4px 12px", borderRadius: 999, border: `1px solid ${sc.border}`, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                  <span style={{ fontSize: 13, color: ui.colors.textMuted, display: "inline-block", flexShrink: 0, transform: isCollapsed ? "none" : "rotate(180deg)", transition: "transform 0.2s" }}>▾</span>
                </div>

                {/* ── Expanded Body ── */}
                {!isCollapsed && (
                  <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

                    {/* Summary */}
                    {t.task.description && (
                      <div style={{ padding: "10px 14px", background: ui.colors.bgSoft, borderRadius: 8, border: `1px solid ${ui.colors.border}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: ui.colors.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Summary</div>
                        <div style={{ fontSize: 13, color: ui.colors.textSoft, lineHeight: 1.6 }}>{t.task.description}</div>
                      </div>
                    )}

                    {/* Branch */}
                    {t.githubBranch && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: ui.colors.textMuted }}>Branch:</span>
                        <a href={buildBranchUrl(githubRepoUrl, t.githubBranch)} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#eff6ff", color: "#1d4ed8", padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 12, fontFamily: "monospace", textDecoration: "none", border: "1px solid #bfdbfe" }}>
                          {t.githubBranch}
                        </a>
                        <span style={{ fontSize: 11, color: ui.colors.textMuted }}>Assigned {relativeTime(t.assignedAt)}</span>
                      </div>
                    )}

                    {/* ⚠️ Changes Requested banner */}
                    {t.reviewNotes && isNeedsChanges && (
                      <div style={{ background: ui.colors.warningSoft, border: `1px solid #fdba74`, borderLeft: "4px solid #f97316", borderRadius: 10, padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 16 }}>⚠️</span>
                          <span style={{ fontWeight: 900, fontSize: 12, color: ui.colors.warning, textTransform: "uppercase", letterSpacing: 0.5 }}>Action Required — Changes Requested</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "#7c2d12", lineHeight: 1.6 }}>{t.reviewNotes}</p>
                      </div>
                    )}

                    {/* Evaluator feedback (non-needs-changes) */}
                    {t.reviewNotes && !isNeedsChanges && (
                      <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                        <strong style={{ color: "#92400e" }}>Evaluator feedback:</strong>{" "}
                        <span style={{ color: "#78350f" }}>{t.reviewNotes}</span>
                      </div>
                    )}

                    {/* ── Action Section ── */}
                    <div style={{ borderTop: `1px solid ${ui.colors.border}`, paddingTop: 14 }}>
                      {t.status === "ASSIGNED" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <p style={{ margin: 0, fontSize: 13, color: ui.colors.textMuted }}>Ready to begin? Click below to mark this task as in progress.</p>
                          <button onClick={() => handleStartTask(t.assignmentId)} disabled={actionLoading[t.assignmentId]}
                            style={{ ...buttonBase, alignSelf: "flex-start", padding: "10px 22px", background: actionLoading[t.assignmentId] ? "#a5b4fc" : ui.colors.primary, color: "#fff", fontWeight: 800, fontSize: 14 }}>
                            {actionLoading[t.assignmentId] ? "Starting…" : "Start Task"}
                          </button>
                        </div>
                      ) : canSubmit ? (
                        <div>
                          {/* Side-by-side method toggle */}
                          <div style={{ display: "inline-flex", border: `1px solid ${ui.colors.borderStrong}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                            {(["github", "zip"] as const).map((m, i) => (
                              <button key={m}
                                onClick={() => setSubmitMethod((p) => ({ ...p, [t.assignmentId]: m }))}
                                style={{ padding: "9px 20px", background: activeMethod === m ? ui.colors.primary : "#fff", color: activeMethod === m ? "#fff" : ui.colors.text, fontWeight: 700, fontSize: 13, cursor: "pointer", border: "none", borderLeft: i > 0 ? `1px solid ${ui.colors.borderStrong}` : "none" }}>
                                {m === "github" ? "Submit via GitHub PR" : "Submit via ZIP"}
                              </button>
                            ))}
                          </div>

                          {activeMethod === "github" ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 540 }}>
                              <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: ui.colors.textMuted }}>PR Number</label>
                                <input type="number" placeholder="e.g. 23" value={prNumber[t.assignmentId] || ""}
                                  onChange={(e) => setPrNumber((p) => ({ ...p, [t.assignmentId]: e.target.value }))}
                                  style={{ ...inputBase, width: 160, padding: "8px 12px" }} />
                                <div style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 4 }}>The PR link is generated automatically from your repo.</div>
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: ui.colors.textMuted }}>Submission Note (optional)</label>
                                <textarea rows={3} placeholder="Describe what you implemented…" value={subNote[t.assignmentId] || ""}
                                  onChange={(e) => setSubNote((p) => ({ ...p, [t.assignmentId]: e.target.value }))}
                                  style={{ ...inputBase, width: "100%", padding: "8px 12px", resize: "vertical", minHeight: 60 }} />
                              </div>
                              {/* Submit + Preview side by side */}
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                <button onClick={() => handleGitHubSubmit(t.assignmentId)} disabled={actionLoading[t.assignmentId]}
                                  style={{ ...buttonBase, padding: "10px 22px", background: actionLoading[t.assignmentId] ? "#86efac" : "#16a34a", color: "#fff", fontWeight: 800 }}>
                                  {actionLoading[t.assignmentId] ? "Submitting…" : "Submit PR"}
                                </button>
                                <button
                                  onClick={() => setPreviewOpen((p) => ({ ...p, [t.assignmentId]: !p[t.assignmentId] }))}
                                  style={{ ...buttonBase, padding: "10px 18px", fontWeight: 700, fontSize: 13, background: previewOpen[t.assignmentId] ? ui.colors.primarySoft : "#fff", color: previewOpen[t.assignmentId] ? ui.colors.primary : ui.colors.textSoft, border: `1px solid ${previewOpen[t.assignmentId] ? ui.colors.primary : ui.colors.borderStrong}` }}>
                                  {previewOpen[t.assignmentId] ? "Hide Preview" : "Preview My Score"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              <input type="file" accept=".zip" ref={(el) => { fileRefs.current[t.assignmentId] = el; }} style={{ display: "none" }}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleZipSubmit(t.assignmentId, f); }} />
                              {/* Upload + Preview side by side */}
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                <button onClick={() => fileRefs.current[t.assignmentId]?.click()} disabled={actionLoading[t.assignmentId]}
                                  style={{ ...buttonBase, padding: "10px 22px", background: actionLoading[t.assignmentId] ? "#86efac" : "#16a34a", color: "#fff", fontWeight: 800 }}>
                                  {actionLoading[t.assignmentId] ? "Uploading…" : "Upload ZIP"}
                                </button>
                                <button
                                  onClick={() => setPreviewOpen((p) => ({ ...p, [t.assignmentId]: !p[t.assignmentId] }))}
                                  style={{ ...buttonBase, padding: "10px 18px", fontWeight: 700, fontSize: 13, background: previewOpen[t.assignmentId] ? ui.colors.primarySoft : "#fff", color: previewOpen[t.assignmentId] ? ui.colors.primary : ui.colors.textSoft, border: `1px solid ${previewOpen[t.assignmentId] ? ui.colors.primary : ui.colors.borderStrong}` }}>
                                  {previewOpen[t.assignmentId] ? "Hide Preview" : "Preview My Score"}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Preview panel — expands below both buttons */}
                          {previewOpen[t.assignmentId] && (
                            <div style={{ marginTop: 12, padding: 14, background: ui.colors.bgSoft, borderRadius: 10, border: `1px solid ${ui.colors.border}` }}>
                              <div style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 10 }}>Check your similarity score before submitting — nothing is saved.</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {t.githubBranch && (
                                  <button onClick={() => handlePreviewGithub(t.assignmentId)} disabled={previewLoading[t.assignmentId]}
                                    style={{ ...buttonBase, padding: "7px 14px", background: ui.colors.bgDark, color: "#fff", fontWeight: 700, fontSize: 12 }}>
                                    {previewLoading[t.assignmentId] ? "Analyzing…" : "From GitHub Branch"}
                                  </button>
                                )}
                                <button onClick={() => previewZipRefs.current[t.assignmentId]?.click()} disabled={previewLoading[t.assignmentId]}
                                  style={{ ...buttonBase, padding: "7px 14px", background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 12 }}>
                                  {previewLoading[t.assignmentId] ? "Analyzing…" : "From ZIP File"}
                                </button>
                                <input type="file" accept=".zip" ref={(el) => { previewZipRefs.current[t.assignmentId] = el; }} style={{ display: "none" }}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePreviewZip(t.assignmentId, f); }} />
                              </div>

                              {previewResult[t.assignmentId] && (() => {
                                const r = previewResult[t.assignmentId]!;
                                return (
                                  <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 10, background: r.passes ? "#f0fdf4" : "#fef2f2", border: `1px solid ${r.passes ? "#bbf7d0" : "#fecaca"}` }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <span style={{ fontSize: 20 }}>{r.passes ? "✅" : "⚠️"}</span>
                                      <div>
                                        <div style={{ fontWeight: 800, fontSize: 14, color: r.passes ? "#15803d" : "#dc2626" }}>
                                          {r.passes ? "Looks good — above threshold!" : "Below threshold — consider improving."}
                                        </div>
                                        <div style={{ fontSize: 12, color: r.passes ? "#166534" : "#991b1b", marginTop: 3 }}>
                                          Similarity: <strong>{r.similarityPct}%</strong> &nbsp;/&nbsp; Threshold: <strong>{r.thresholdPct}%</strong>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {previewError[t.assignmentId] && (
                                <div style={{ marginTop: 10, fontSize: 12, color: ui.colors.danger, fontWeight: 700 }}>❌ {previewError[t.assignmentId]}</div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: ui.colors.textMuted }}>
                          {t.status === "SUBMITTED" || t.status === "UNDER_REVIEW"
                            ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706", display: "inline-block", flexShrink: 0 }} />
                                Submitted {relativeTime(t.submittedAt)} — waiting for evaluator review.
                              </span>
                            : t.status === "ACCEPTED" || t.status === "MERGED"
                              ? <span style={{ color: "#16a34a", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block", flexShrink: 0 }} />
                                  Accepted and merged. Great work!
                                </span>
                              : t.status === "REJECTED"
                                ? <span style={{ color: ui.colors.danger, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: ui.colors.danger, display: "inline-block", flexShrink: 0 }} />
                                    Submission rejected.
                                  </span>
                                : <span>Status: {STATUS_LABELS[t.status] ?? t.status}</span>
                          }
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
