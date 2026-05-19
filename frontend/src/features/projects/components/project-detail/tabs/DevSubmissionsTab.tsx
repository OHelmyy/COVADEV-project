import { useEffect, useState } from "react";
import {
  fetchDevSubmissions,
  fetchSubmissionFileTree,
  fetchSubmissionFileContent,
  acceptSubmission,
  rejectSubmission,
  reassignSubmission,
  acceptGitHubPR,
  type DevSubmission,
  type SubmissionAttempt,
  type FileTreeNode,
} from "../../../../../api/projects";
import {
  fetchGitHubRepo,
  fetchGitHubPullRequests,
  fetchGitHubPullRequestFiles,
  fetchGitHubPullRequestCommits,
  fetchGitHubFileContent,
  type GitHubPullRequestApi,
  type GitHubFileApi,
  type GitHubCommitApi,
} from "../../../../../api/github";
import { Card } from "../ProjectUi";

type Props = { projectId: number; isAdmin?: boolean };

const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  PENDING:    { bg: "#fff8e1", fg: "#8a5a00", border: "#ffe58f" },
  ACCEPTED:   { bg: "#eef5e0", fg: "#2d6a0f", border: "#b7eb8f" },
  REJECTED:   { bg: "#ffecec", fg: "#a00000", border: "#ffccc7" },
  REASSIGNED: { bg: "#f0ecff", fg: "#4a1fa8", border: "#d3adf7" },
};

const STATUS_ICONS: Record<string, string> = {
  PENDING: "⏳",
  ACCEPTED: "✅",
  REJECTED: "❌",
  REASSIGNED: "🔁",
};

// ── Main Tab ─────────────────────────────────────────────────────────────────

export default function DevSubmissionsTab({ projectId, isAdmin }: Props) {
  const [submissions, setSubmissions] = useState<DevSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
const [githubConnected, setGithubConnected] = useState(false);
  const [prs, setPrs] = useState<GitHubPullRequestApi[]>([]);
  const [githubLoading, setGithubLoading] = useState(true);

  useEffect(() => {
    fetchGitHubRepo(projectId)
      .then(repo => {
        if (repo?.is_connected) {
          setGithubConnected(true);
          return fetchGitHubPullRequests(projectId, "all");
        }
        return [];
      })
      .then(data => setPrs(data))
      .catch(() => {})
      .finally(() => setGithubLoading(false));
  }, [projectId]);
  if (loading) return <Card><div style={{ color: "#888", padding: 24, textAlign: "center" }}>Loading submissions…</div></Card>;
  if (error)   return <Card><div style={{ color: "#a00", padding: 24 }}>{error}</div></Card>;

  const pending  = submissions.filter(s => s.latestStatus === "PENDING");
  const reviewed = submissions.filter(s => s.latestStatus !== "PENDING");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Developer Submissions</h2>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>
            {submissions.length} task{submissions.length !== 1 ? "s" : ""} submitted
            {pending.length > 0 && <span style={{ color: "#8a5a00", fontWeight: 600 }}> · {pending.length} awaiting review</span>}
          </p>
        </div>
        <button
          onClick={load}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontSize: 13, background: "#fff" }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* GitHub Pull Requests Section */}
      <GitHubPRSection
        projectId={projectId}
        prs={prs}
        loading={githubLoading}
        connected={githubConnected}
        isAdmin={isAdmin}
        submissions={submissions}
        onRefresh={() => {
          fetchGitHubPullRequests(projectId, "all")
            .then(data => setPrs(data))
            .catch(() => {});
        }}
      />

      {submissions.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 600 }}>No submissions yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Developers haven't submitted any work yet.</div>
          </div>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <SectionHeader label="Awaiting Review" count={pending.length} color="#8a5a00" bg="#fff8e1" />
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
                {pending.map(sub => (
                  <AssignmentCard key={sub.assignmentId} sub={sub} projectId={projectId} onRefresh={load} />
                ))}
              </div>
            </section>
          )}
          {reviewed.length > 0 && (
            <section>
              <SectionHeader label="Reviewed" count={reviewed.length} color="#444" bg="#f5f5f5" />
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
                {reviewed.map(sub => (
                  <AssignmentCard key={sub.assignmentId} sub={sub} projectId={projectId} onRefresh={load} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeader({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontWeight: 700, fontSize: 15, color }}>{label}</span>
      <span style={{ background: bg, color, fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 12 }}>{count}</span>
      <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
    </div>
  );
}

// ── Assignment Card (groups all attempts for one task/developer) ──────────────

function AssignmentCard({ sub, projectId, onRefresh }: { sub: DevSubmission; projectId: number; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(sub.latestStatus === "PENDING");
  const latest = sub.attempts[0];
  const colors = STATUS_COLORS[sub.latestStatus] ?? STATUS_COLORS.PENDING;

  return (
    <div style={{
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      overflow: "hidden",
      background: "#fff",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      {/* Card Header — click to expand/collapse */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", cursor: "pointer",
          background: expanded ? "#fafafa" : "#fff",
          borderBottom: expanded ? `1px solid ${colors.border}` : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 22 }}>{STATUS_ICONS[sub.latestStatus]}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {sub.taskName}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              <span style={{ fontWeight: 600 }}>{sub.developerName || sub.developerEmail}</span>
              <span style={{ color: "#aaa" }}> · {sub.developerEmail}</span>
              <span style={{ color: "#aaa" }}> · {sub.totalAttempts} attempt{sub.totalAttempts !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {latest.similarityScore !== null && latest.similarityScore !== undefined && (
            <ScoreBadge score={latest.similarityScore} />
          )}
          <span style={{
            background: colors.bg, color: colors.fg,
            fontWeight: 700, fontSize: 11, padding: "3px 10px", borderRadius: 12,
          }}>
            {sub.latestStatus}
          </span>
          <span style={{
            color: "#aaa", fontSize: 18,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.2s", display: "inline-block",
          }}>
            ▾
          </span>
        </div>
      </div>

      {/* Expanded Body — all attempts */}
      {expanded && (
        <div style={{ padding: "8px 0 4px" }}>
          {sub.attempts.map((attempt, idx) => (
            <AttemptRow
              key={attempt.id}
              attempt={attempt}
              isLatest={idx === 0}
              isOnly={sub.attempts.length === 1}
              projectId={projectId}
              taskDescription={sub.taskDescription}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Individual Attempt Row ────────────────────────────────────────────────────

function AttemptRow({
  attempt, isLatest, isOnly, projectId, taskDescription, onRefresh,
}: {
  attempt: SubmissionAttempt;
  isLatest: boolean;
  isOnly: boolean;
  projectId: number;
  taskDescription: string;
  onRefresh: () => void;
}) {
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const colors = STATUS_COLORS[attempt.status] ?? STATUS_COLORS.PENDING;
  const isPending = attempt.status === "PENDING";
  const isAccepted = attempt.status === "ACCEPTED";

  async function doAccept() {
    setActing(true); setActionMsg("");
    try {
      const res = await acceptSubmission(projectId, attempt.id);
      if ((res as any).belowThreshold) {
        setActionMsg(`⚠️ Score too low (${(res as any).similarity} / threshold ${(res as any).threshold}). Please reject or reassign.`);
      } else {
        setActionMsg("✅ Accepted successfully.");
        onRefresh();
      }
    } catch (e: any) { setActionMsg(`Error: ${e.message}`); }
    finally { setActing(false); }
  }

  async function doReject() {
    setActing(true); setActionMsg("");
    try {
      await rejectSubmission(projectId, attempt.id, feedback);
      setActionMsg("✓ Rejected.");
      onRefresh();
    } catch (e: any) { setActionMsg(`Error: ${e.message}`); }
    finally { setActing(false); }
  }

  async function doReassign() {
    setActing(true); setActionMsg("");
    try {
      await reassignSubmission(projectId, attempt.id, feedback);
      setActionMsg("✓ Reassigned.");
      onRefresh();
    } catch (e: any) { setActionMsg(`Error: ${e.message}`); }
    finally { setActing(false); }
  }

  return (
    <div style={{
      margin: "0 12px 8px",
      borderRadius: 10,
      border: `1px solid ${isLatest ? colors.border : "#e5e7eb"}`,
      background: isLatest ? (colors.bg + "44") : "#fafafa",
      overflow: "hidden",
    }}>
      {/* Attempt Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {!isOnly && (
            <span style={{
              background: isLatest ? colors.fg : "#aaa",
              color: "#fff", fontSize: 10, fontWeight: 700,
              padding: "2px 7px", borderRadius: 8,
            }}>
              Attempt #{attempt.attemptNumber}{isLatest ? " · Latest" : ""}
            </span>
          )}
          <span style={{ fontSize: 12, color: "#888" }}>
            {new Date(attempt.submittedAt).toLocaleString()}
          </span>
          {attempt.reviewedAt && (
            <span style={{ fontSize: 12, color: "#aaa" }}>
              · Reviewed {new Date(attempt.reviewedAt).toLocaleString()}
              {attempt.reviewedBy && ` by ${attempt.reviewedBy}`}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {attempt.similarityScore !== null && attempt.similarityScore !== undefined && (
            <ScoreBadge score={attempt.similarityScore} />
          )}
          <span style={{ background: colors.bg, color: colors.fg, fontWeight: 700, fontSize: 10, padding: "2px 8px", borderRadius: 8 }}>
            {STATUS_ICONS[attempt.status]} {attempt.status}
          </span>
        </div>
      </div>

      {/* Task Description (only on latest attempt) */}
      {isLatest && taskDescription && (
        <div style={{ padding: "0 14px 10px" }}>
          <div style={{ fontSize: 12, color: "#555", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 10px" }}>
            <strong style={{ color: "#333" }}>Task: </strong>{taskDescription}
          </div>
        </div>
      )}

      {/* Feedback from evaluator */}
      {attempt.feedback && (
        <div style={{ margin: "0 14px 10px", background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
          <strong>Feedback:</strong> {attempt.feedback}
        </div>
      )}

      {/* File Browser */}
      {attempt.hasFiles && (
        <div style={{ padding: "0 14px 10px" }}>
          <button
            onClick={() => setFileTreeOpen(o => !o)}
            style={{
              fontSize: 12, padding: "6px 14px", borderRadius: 7, cursor: "pointer",
              border: "1px solid #d0d7de",
              background: fileTreeOpen ? "#f0f7ff" : "#fff",
              color: fileTreeOpen ? "#0969da" : "#444",
              fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span>{fileTreeOpen ? "📂" : "📁"}</span>
            <span>{fileTreeOpen ? "Hide" : "Browse"} Submitted Files</span>
            {attempt.zipFileName && (
              <span style={{ color: "#aaa", fontWeight: 400 }}>({attempt.zipFileName})</span>
            )}
          </button>
          {fileTreeOpen && (
            <FileBrowser projectId={projectId} submissionId={attempt.id} />
          )}
        </div>
      )}

      {/* Download ZIP */}
      {attempt.zipUrl && (
        <div style={{ padding: "0 14px 10px" }}>
          <a href={attempt.zipUrl} download style={{ fontSize: 12, color: "#0ea5e9", fontWeight: 600, textDecoration: "none" }}>
            ⬇ Download ZIP
          </a>
        </div>
      )}

      {/* Action Buttons — only on the latest attempt if still actionable */}
      {isLatest && (isPending || isAccepted) && (
        <div style={{ padding: "12px 14px", borderTop: "1px solid #f0f0f0" }}>
          <textarea
            placeholder={
              isPending
                ? "Feedback (optional for Accept, required for Reject / Reassign)"
                : "Feedback for developer (required for Reassign)"
            }
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            rows={2}
            style={{ width: "100%", borderRadius: 8, border: "1px solid #ddd", padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {isPending && <ActionBtn label="✅ Accept" color="#22c55e" onClick={doAccept} busy={acting} />}
            <ActionBtn label="🔁 Reassign" color="#6c47ff" onClick={doReassign} busy={acting} />
            {isPending && <ActionBtn label="❌ Reject" color="#ef4444" onClick={doReject} busy={acting} />}
          </div>
          {actionMsg && (
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: actionMsg.startsWith("Error") || actionMsg.startsWith("⚠") ? "#a00" : "#2d6a0f" }}>
              {actionMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── File Browser ──────────────────────────────────────────────────────────────

function FileBrowser({ projectId, submissionId }: { projectId: number; submissionId: number }) {
  const [tree, setTree] = useState<Record<string, FileTreeNode> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<{ content: string; language: string; truncated: boolean } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    fetchSubmissionFileTree(projectId, submissionId)
      .then(res => setTree(res.tree))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, submissionId]);

  async function openFile(path: string) {
    if (selectedPath === path) { setSelectedPath(null); setFileContent(null); return; }
    setSelectedPath(path);
    setLoadingFile(true);
    try {
      const res = await fetchSubmissionFileContent(projectId, submissionId, path);
      setFileContent(res);
    } catch (e: any) {
      setFileContent({ content: `Error loading file: ${e.message}`, language: "txt", truncated: false });
    } finally {
      setLoadingFile(false);
    }
  }

  if (loading) return <div style={{ padding: "12px 0", color: "#888", fontSize: 13 }}>Loading file tree…</div>;
  if (error)   return <div style={{ padding: "12px 0", color: "#a00", fontSize: 13 }}>{error}</div>;
  if (!tree || Object.keys(tree).length === 0) return <div style={{ padding: "12px 0", color: "#888", fontSize: 13 }}>No files found.</div>;

  return (
    <div style={{ marginTop: 8, border: "1px solid #d0d7de", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
      <div style={{ display: "grid", gridTemplateColumns: selectedPath ? "220px 1fr" : "1fr" }}>
        {/* Left: file tree */}
        <div style={{ borderRight: selectedPath ? "1px solid #d0d7de" : "none", overflowY: "auto", maxHeight: 380, padding: "8px 0" }}>
          <TreeNodes nodes={tree} depth={0} selectedPath={selectedPath} onSelect={openFile} />
        </div>

        {/* Right: file content */}
        {selectedPath && (
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{
              padding: "8px 12px", borderBottom: "1px solid #d0d7de", background: "#f6f8fa",
              fontSize: 12, color: "#444", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedPath}
              </span>
              {fileContent?.truncated && (
                <span style={{ color: "#e67e22", fontSize: 11, flexShrink: 0, marginLeft: 8 }}>⚠ Preview truncated (100 KB limit)</span>
              )}
            </div>
            {loadingFile ? (
              <div style={{ padding: 24, color: "#888", fontSize: 13 }}>Loading…</div>
            ) : fileContent ? (
              <pre style={{
                margin: 0, padding: "12px 16px", overflowX: "auto", fontSize: 12, lineHeight: 1.6,
                fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace",
                background: "#fff", maxHeight: 380, overflowY: "auto",
                whiteSpace: "pre-wrap", wordBreak: "break-all",
              }}>
                <code>{fileContent.content}</code>
              </pre>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNodes({ nodes, depth, selectedPath, onSelect }: {
  nodes: Record<string, FileTreeNode>;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <>
      {Object.values(nodes).map(node => (
        <TreeNode key={node.name} node={node} depth={depth} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </>
  );
}

function TreeNode({ node, depth, selectedPath, onSelect }: {
  node: FileTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);

  if (node.type === "dir") {
    return (
      <div>
        <div
          onClick={() => setOpen(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: `4px 12px 4px ${12 + depth * 14}px`, cursor: "pointer", fontSize: 12, color: "#444", userSelect: "none" }}
        >
          <span>{open ? "📂" : "📁"}</span>
          <span style={{ fontWeight: 600 }}>{node.name}</span>
        </div>
        {open && node.children && (
          <TreeNodes nodes={node.children} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
        )}
      </div>
    );
  }

  const ext = node.name.split(".").pop() || "";
  const isSelected = selectedPath === node.path;

  return (
    <div
      onClick={() => node.previewable && node.path && onSelect(node.path)}
      title={node.previewable ? node.path : `${node.path} (binary — not previewable)`}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: `4px 12px 4px ${12 + depth * 14}px`,
        cursor: node.previewable ? "pointer" : "default",
        fontSize: 12,
        background: isSelected ? "#dbeafe" : "transparent",
        color: isSelected ? "#1d4ed8" : node.previewable ? "#24292f" : "#aaa",
        borderLeft: isSelected ? "2px solid #3b82f6" : "2px solid transparent",
      }}
    >
      <span>{getFileIcon(ext)}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
      {!node.previewable && <span style={{ fontSize: 10, color: "#ccc", marginLeft: "auto", paddingRight: 4 }}>binary</span>}
    </div>
  );
}
// ── GitHub PR Section ─────────────────────────────────────────────────────────

function GitHubPRSection({ projectId, prs, loading, connected, submissions, onRefresh }: {  projectId: number;
  prs: GitHubPullRequestApi[];
  loading: boolean;
  connected: boolean;
  isAdmin?: boolean;
  submissions: DevSubmission[];
  onRefresh: () => void;
}) {
  const [selectedPr, setSelectedPr] = useState<GitHubPullRequestApi | null>(null);
  const [prFiles, setPrFiles] = useState<GitHubFileApi[]>([]);
  const [prCommits, setPrCommits] = useState<GitHubCommitApi[]>([]);
  const [selectedFile, setSelectedFile] = useState<GitHubFileApi | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [merging, setMerging] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | "">("");
  const [mergeMsg, setMergeMsg] = useState<string | null>(null);


  async function handleSelectPr(pr: GitHubPullRequestApi) {
    if (selectedPr?.number === pr.number) { setSelectedPr(null); return; }
    setSelectedPr(pr);
    setSelectedFile(null);
    setFileContent(null);
    setSelectedAssignmentId("");
    setMergeMsg(null);
    try {
      const [files, commits] = await Promise.all([
        fetchGitHubPullRequestFiles(projectId, pr.number),
        fetchGitHubPullRequestCommits(projectId, pr.number),
      ]);
      setPrFiles(files);
      setPrCommits(commits);
    } catch {}
  }

  async function handleViewFile(file: GitHubFileApi) {
    if (selectedFile?.filename === file.filename) { setSelectedFile(null); setFileContent(null); return; }
    setSelectedFile(file);
    setLoadingContent(true);
    try {
      const res = await fetchGitHubFileContent(projectId, file.filename, selectedPr?.head.sha);
      setFileContent(res.content);
    } catch { setFileContent("Could not load file content."); }
    finally { setLoadingContent(false); }
  }

  async function handleAcceptAndMerge(pr: GitHubPullRequestApi) {
    if (!selectedAssignmentId) return;
    setMerging(true);
    setMergeMsg(null);
    try {
      const res = await acceptGitHubPR(projectId, Number(selectedAssignmentId), pr.number);
      if (res.ok) {
        setMergeMsg(`✅ Merged & matched! Similarity: ${res.similarity != null ? (res.similarity * 100).toFixed(1) + "%" : "N/A"}`);
        onRefresh();
      } else if (res.belowThreshold) {
        setMergeMsg(`⚠️ Score ${((res.similarity ?? 0) * 100).toFixed(1)}% is below threshold ${((res.threshold ?? 0) * 100).toFixed(1)}%. Reject or reassign this developer.`);
      } else {
        setMergeMsg(`❌ ${res.detail ?? "Failed"}`);
      }
    } catch (e: any) {
      setMergeMsg(`❌ ${e?.message ?? "Error"}`);
    } finally {
      setMerging(false);
    }
  }

  const openPrs   = prs.filter(p => p.state === "open");
  const closedPrs = prs.filter(p => p.state !== "open");

  return (
    <div style={{ border: "1px solid #d0d7de", borderRadius: 14, overflow: "hidden", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", cursor: "pointer", background: "#f6f8fa", borderBottom: expanded ? "1px solid #d0d7de" : "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🐙</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>GitHub Pull Requests</span>
          {!loading && connected && (
            <>
              {openPrs.length > 0 && <span style={{ background: "#fff8e1", color: "#8a5a00", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{openPrs.length} open</span>}
              {closedPrs.length > 0 && <span style={{ background: "#f5f5f5", color: "#666", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{closedPrs.length} closed</span>}
            </>
          )}
        </div>
        <span style={{ color: "#aaa", fontSize: 18, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
      </div>

      {expanded && (
        <div style={{ padding: 16 }}>
          {loading ? (
            <div style={{ color: "#888", fontSize: 13 }}>Loading GitHub data…</div>
          ) : !connected ? (
            <div style={{ color: "#888", fontSize: 13, padding: "8px 0" }}>No GitHub repository connected to this project yet. Connect one in the GitHub tab.</div>
          ) : prs.length === 0 ? (
            <div style={{ color: "#888", fontSize: 13, padding: "8px 0" }}>No pull requests found in this repository.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: selectedPr ? "280px 1fr" : "1fr", gap: 16 }}>
              {/* PR List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {openPrs.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8a5a00", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Open</div>
                    {openPrs.map(pr => <PRCard key={pr.number} pr={pr} selected={selectedPr?.number === pr.number} onSelect={handleSelectPr} />)}
                  </>
                )}
                {closedPrs.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginTop: 8, marginBottom: 2 }}>Closed / Merged</div>
                    {closedPrs.map(pr => <PRCard key={pr.number} pr={pr} selected={selectedPr?.number === pr.number} onSelect={handleSelectPr} />)}
                  </>
                )}
              </div>

              {/* PR Detail */}
              {selectedPr && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* PR Header */}
                  <div style={{ background: "#f6f8fa", borderRadius: 10, border: "1px solid #d0d7de", padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedPr.title}</div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                          <span style={{ background: selectedPr.state === "open" ? "#2da44e" : "#8250df", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, marginRight: 6 }}>
                            {selectedPr.state.toUpperCase()}
                          </span>
                          #{selectedPr.number} by <strong>{selectedPr.user.login}</strong> · {selectedPr.head.ref} → {selectedPr.base.ref}
                        </div>
                      </div>
<div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <a href={selectedPr.html_url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #d0d7de", background: "#fff", color: "#24292f", textDecoration: "none", fontWeight: 600 }}>
                          View on GitHub
                        </a>
                        {selectedPr.state === "open" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
                            <select
                              value={selectedAssignmentId}
                              onChange={e => setSelectedAssignmentId(e.target.value === "" ? "" : Number(e.target.value))}
                              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #d0d7de", fontSize: 12 }}
                            >
                              <option value="">— Link to assignment —</option>
                              {submissions
                                .filter(s => s.assignmentStatus !== "ACCEPTED" && s.assignmentStatus !== "MERGED")
                                .map(s => (
                                  <option key={s.assignmentId} value={s.assignmentId}>
                                    {s.taskName} · {s.developerName || s.developerEmail}
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={() => handleAcceptAndMerge(selectedPr)}
                              disabled={merging || selectedAssignmentId === ""}
                              style={{
                                fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "none",
                                background: merging || selectedAssignmentId === "" ? "#ccc" : "#2da44e",
                                color: "#fff", fontWeight: 700,
                                cursor: merging || selectedAssignmentId === "" ? "not-allowed" : "pointer",
                              }}
                            >
                              {merging ? "Running pipeline…" : "✅ Accept & Merge"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {mergeMsg && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: mergeMsg.startsWith("✅") ? "#f0fdf4" : mergeMsg.startsWith("⚠") ? "#fffbe6" : "#fef2f2",
                      color: mergeMsg.startsWith("✅") ? "#16a34a" : mergeMsg.startsWith("⚠") ? "#8a5a00" : "#dc2626",
                      border: `1px solid ${mergeMsg.startsWith("✅") ? "#bbf7d0" : mergeMsg.startsWith("⚠") ? "#ffe58f" : "#fecaca"}`,
                    }}>
                      {mergeMsg}
                    </div>
                  )}

                  {/* Commits */}
                  {prCommits.length > 0 && (
                    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #d0d7de", padding: "12px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Commits ({prCommits.length})</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {prCommits.map(c => (
                          <div key={c.sha} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
                            <span style={{ color: "#aaa", fontFamily: "monospace", flexShrink: 0 }}>{c.sha.slice(0, 7)}</span>
                            <span style={{ color: "#333" }}>{c.commit.message.split("\n")[0]}</span>
                            <span style={{ color: "#aaa", flexShrink: 0, marginLeft: "auto" }}>{c.commit.author.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Changed Files + Content */}
                  <div style={{ display: "grid", gridTemplateColumns: selectedFile ? "220px 1fr" : "1fr", gap: 12 }}>
                    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #d0d7de", padding: "12px 0" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, padding: "0 14px 8px" }}>Changed Files ({prFiles.length})</div>
                      {prFiles.map(f => (
                        <div
                          key={f.filename}
                          onClick={() => handleViewFile(f)}
                          style={{
                            padding: "5px 14px", cursor: "pointer", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: selectedFile?.filename === f.filename ? "#dbeafe" : "transparent",
                            color: selectedFile?.filename === f.filename ? "#1d4ed8" : "#24292f",
                            borderLeft: selectedFile?.filename === f.filename ? "2px solid #3b82f6" : "2px solid transparent",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</span>
                          <span style={{ fontWeight: 700, color: f.status === "added" ? "#2da44e" : f.status === "removed" ? "#cf222e" : "#8c959f", flexShrink: 0, marginLeft: 6 }}>
                            {f.status === "added" ? "+" : f.status === "removed" ? "−" : "M"}
                          </span>
                        </div>
                      ))}
                    </div>

                    {selectedFile && (
                      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #d0d7de", overflow: "hidden" }}>
                        <div style={{ padding: "8px 12px", background: "#f6f8fa", borderBottom: "1px solid #d0d7de", fontSize: 12, fontFamily: "monospace", color: "#444" }}>
                          {selectedFile.filename}
                        </div>
                        {loadingContent ? (
                          <div style={{ padding: 16, color: "#888", fontSize: 13 }}>Loading…</div>
                        ) : (
                          <pre style={{ margin: 0, padding: "12px 16px", fontSize: 12, fontFamily: "ui-monospace, monospace", overflowX: "auto", maxHeight: 400, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                            <code>{fileContent}</code>
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PRCard({ pr, selected, onSelect }: { pr: GitHubPullRequestApi; selected: boolean; onSelect: (pr: GitHubPullRequestApi) => void }) {
  return (
    <div
      onClick={() => onSelect(pr)}
      style={{
        padding: "10px 12px", borderRadius: 8, cursor: "pointer",
        border: selected ? "1px solid #3b82f6" : "1px solid #d0d7de",
        background: selected ? "#dbeafe" : "#fff",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, color: selected ? "#1d4ed8" : "#24292f" }}>#{pr.number} {pr.title}</div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>
        by {pr.user.login} · {new Date(pr.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}
// ── Small helpers ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 75 ? "#2d6a0f" : pct >= 50 ? "#8a5a00" : "#a00000";
  const bg    = pct >= 75 ? "#eef5e0" : pct >= 50 ? "#fff8e1" : "#ffecec";
  return (
    <span style={{ background: bg, color, fontWeight: 700, fontSize: 11, padding: "2px 10px", borderRadius: 12, border: `1px solid ${color}33` }}>
      {pct}% match
    </span>
  );
}

function ActionBtn({ label, color, onClick, busy }: { label: string; color: string; onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: busy ? "#ccc" : color, color: "#fff", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", fontSize: 13 }}
    >
      {busy ? "…" : label}
    </button>
  );
}

function getFileIcon(ext: string): string {
  const map: Record<string, string> = {
    py: "🐍", js: "📜", ts: "📘", tsx: "⚛️", jsx: "⚛️",
    java: "☕", cpp: "⚙️", c: "⚙️", h: "📎", cs: "🔷",
    go: "🐹", rs: "🦀", rb: "💎", php: "🐘",
    html: "🌐", css: "🎨", scss: "🎨",
    json: "📋", xml: "📋", yaml: "📋", yml: "📋",
    md: "📝", txt: "📄", sh: "🔧", sql: "🗃️",
  };
  return map[ext.toLowerCase()] || "📄";
}
