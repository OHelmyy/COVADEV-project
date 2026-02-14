// frontend/src/pages/ProjectDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusMessage from "../components/StatusMessage";
import {
  fetchProjectDetail,
  runAnalysis,
  updateThreshold,
  uploadBpmn,
  uploadCodeZip,
  fetchFiles,
  fetchMatches,
  fetchTasks,
  deleteProject,
} from "../api/projects";
import type { ProjectDetailApi } from "../api/types";

type LoadState = "idle" | "loading" | "success" | "error";

type TaskRow = { task_id: string; name: string; description?: string };
type FileRow = { relative_path: string; ext: string; size_bytes: number };
type MatchRow = {
  status: string;
  similarity_score: number;
  task: null | { task_id: string; name: string };
  code_ref: string;
};

type TabKey = "overview"  | "uploads" | "bpmnCheck"| "settings" | "results" | "runs" | "members";

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const id = useMemo(() => Number(projectId), [projectId]);

  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<ProjectDetailApi | null>(null);
  const [errorText, setErrorText] = useState("");

  const [bpmnFile, setBpmnFile] = useState<File | null>(null);
  const [codeZip, setCodeZip] = useState<File | null>(null);

  const [thresholdInput, setThresholdInput] = useState("");
  const [actionMsg, setActionMsg] = useState<string>("");

  // Results state
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [resultsError, setResultsError] = useState<string>("");
  const [resultsLoading, setResultsLoading] = useState<boolean>(false);

  const role = String(data?.membership.role || "").toUpperCase();
  const isAdmin = role === "ADMIN";
  const isEvaluator = role === "EVALUATOR";
  const isDeveloper = role === "DEVELOPER";

  // Permissions
  const canUploadBpmn = isEvaluator; // evaluator only
  const canUploadCode = isEvaluator || isDeveloper; // evaluator + developer
  const canRunAnalysis = isEvaluator || isDeveloper; // evaluator + developer
  const canUpdateThreshold = isEvaluator; // evaluator only
  const canManageMembers = isEvaluator; // evaluator only
  const canViewUploadLogs = isEvaluator; // evaluator only

  // Tabs (filtered by role)
  const tabs = useMemo(() => {
    const all: { key: TabKey; label: string; visible: boolean }[] = [
      { key: "overview", label: "Overview", visible: true },

      // ✅ NEW: BPMN Check available for ALL roles
      
      { key: "uploads", label: "Uploads & Analysis", visible: !isAdmin }, // hide for admin
      { key: "bpmnCheck", label: "BPMN Check", visible: true },
      { key: "settings", label: "Settings", visible: canUpdateThreshold || canManageMembers || canViewUploadLogs }, // evaluator only
      { key: "results", label: "Results", visible: true },
      { key: "runs", label: "Runs", visible: true },

      { key: "members", label: "Members", visible: true },
    ];
    return all.filter((t) => t.visible);
  }, [isAdmin, canUpdateThreshold, canManageMembers, canViewUploadLogs]);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Ensure active tab always valid when role/data changes
  useEffect(() => {
    const keys = new Set(tabs.map((t) => t.key));
    if (!keys.has(activeTab)) setActiveTab(tabs[0]?.key ?? "overview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length, role]);

  async function load() {
    try {
      setState("loading");
      setErrorText("");
      const res = await fetchProjectDetail(id);
      setData(res);
      setThresholdInput(String(res.project.similarityThreshold));
      setState("success");
    } catch (e: any) {
      setState("error");
      setErrorText(e?.message ?? "Failed to load project");
    }
  }

  async function loadResults() {
    if (!Number.isFinite(id)) return;
    setResultsLoading(true);
    setResultsError("");
    try {
      const [t, f, m] = await Promise.all([fetchTasks(id), fetchFiles(id), fetchMatches(id)]);
      setTasks((t?.tasks ?? []) as TaskRow[]);
      setFiles((f?.files ?? []) as FileRow[]);
      setMatches((m?.matches ?? []) as MatchRow[]);
    } catch (e: any) {
      setResultsError(e?.message ?? "Failed to load analysis results");
    } finally {
      setResultsLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    load();
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onUploadBpmn() {
    if (!bpmnFile) return;
    setActionMsg("Uploading BPMN...");
    try {
      await uploadBpmn(id, bpmnFile);
      setActionMsg("BPMN uploaded ✅");
      setBpmnFile(null);
      await load();
      await loadResults();
    } catch (e: any) {
      setActionMsg(`BPMN upload failed: ${e?.message ?? e}`);
    }
  }

  async function onUploadCode() {
    if (!codeZip) return;
    setActionMsg("Uploading Code ZIP...");
    try {
      await uploadCodeZip(id, codeZip);
      setActionMsg("Code ZIP uploaded & indexed ✅");
      setCodeZip(null);
      await load();
      await loadResults();
    } catch (e: any) {
      setActionMsg(`Code ZIP upload failed: ${e?.message ?? e}`);
    }
  }

  async function onRunAnalysis() {
    setActionMsg("Running analysis...");
    try {
      const res: any = await runAnalysis(id);
      setActionMsg(`Analysis: ${res?.run?.status ?? "DONE"} ✅`);
      await load();
      await loadResults();
    } catch (e: any) {
      setActionMsg(`Analysis failed: ${e?.message ?? e}`);
    }
  }

  async function onUpdateThreshold() {
    setActionMsg("Updating threshold...");
    try {
      await updateThreshold(id, Number(thresholdInput));
      setActionMsg("Threshold updated ✅");
      await load();
      await loadResults();
    } catch (e: any) {
      setActionMsg(`Update failed: ${e?.message ?? e}`);
    }
  }

  //delete function
  async function onDeleteProject() {
    if (!window.confirm("Delete this project permanently? This cannot be undone.")) return;

    setActionMsg("Deleting project...");
    try {
      await deleteProject(id);
      setActionMsg("");
      // send admin back to projects list
      window.location.href = "/projects";
    } catch (e: any) {
      setActionMsg(`Delete failed: ${e?.message ?? e}`);
    }
  }

  //time formating helpers
  function fmtDate(iso?: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
  }

  // Result groups
  const matched = useMemo(
    () => matches.filter((x) => x.task && !String(x.status).toLowerCase().includes("missing")),
    [matches]
  );

  const missing = useMemo(() => {
    const matchedTaskIds = new Set(matched.map((x) => x.task?.task_id).filter(Boolean) as string[]);
    const explicitMissing = matches.filter((x) => String(x.status).toLowerCase().includes("missing"));
    const implicitMissing = tasks.filter((t) => !matchedTaskIds.has(t.task_id));

    const map = new Map<string, { task_id: string; name: string; reason: string }>();

    explicitMissing.forEach((x) => {
      if (x.task) map.set(x.task.task_id, { task_id: x.task.task_id, name: x.task.name, reason: "Marked missing" });
    });

    implicitMissing.forEach((t) => {
      if (!map.has(t.task_id)) map.set(t.task_id, { task_id: t.task_id, name: t.name, reason: "No match found" });
    });

    return Array.from(map.values());
  }, [tasks, matches, matched]);

  const extra = useMemo(() => matches.filter((x) => !x.task || String(x.status).toLowerCase().includes("extra")), [matches]);

  const scoreAvg = useMemo(() => {
    if (matched.length === 0) return 0;
    const s = matched.reduce((acc, x) => acc + (Number(x.similarity_score) || 0), 0);
    return s / matched.length;
  }, [matched]);

  const coverage = useMemo(() => {
    if (tasks.length === 0) return 0;
    const matchedTaskIds = new Set(matched.map((x) => x.task?.task_id).filter(Boolean) as string[]);
    return (matchedTaskIds.size / tasks.length) * 100;
  }, [tasks, matched]);

  if (state === "loading" || state === "idle") return <StatusMessage title="Loading project..." />;
  if (state === "error") return <StatusMessage title="Failed to load project" message={errorText} onRetry={load} />;
  if (!data) return null;

  // BPMN Check payload (optional fields; won't crash if backend doesn't send them)
  const bpmnMeta: any = (data as any)?.activeUploads?.activeBpmn ?? null;
  const isWellFormed = Boolean(bpmnMeta?.isWellFormed);
  const precheckWarnings: string[] = Array.isArray(bpmnMeta?.precheckWarnings) ? bpmnMeta.precheckWarnings : [];
  const precheckErrors: string[] = Array.isArray(bpmnMeta?.precheckErrors) ? bpmnMeta.precheckErrors : [];
  const bpmnSummary: string = typeof bpmnMeta?.bpmnSummary === "string" ? bpmnMeta.bpmnSummary : "";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, alignItems: "start" }}>
      {/* LEFT MENU */}
      <aside style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 10 }}>
        <div style={{ fontWeight: 900, padding: "10px 10px", borderBottom: "1px solid #f3f3f3" }}>Project</div>

        <div style={{ padding: "10px 10px", color: "#666" }}>
          <div style={{ fontWeight: 800 }}>{data.project.name}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
            Role: <b>{data.membership.role}</b>
            {isAdmin ? <span style={{ marginLeft: 6 }}>(read-only)</span> : null}
          </div>
        </div>

        <div style={{ display: "grid", gap: 6, padding: 10 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                textAlign: "left",
                padding: "10px 10px",
                borderRadius: 10,
                border: "1px solid",
                borderColor: activeTab === t.key ? "#094780" : "#eee",
                background: activeTab === t.key ? "#f3f7ff" : "#fff",
                color: activeTab === t.key ? "#094780" : "#333",
                fontWeight: activeTab === t.key ? 800 : 600,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </aside>

      {/* RIGHT CONTENT */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Top message */}
        {actionMsg ? (
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fff" }}>{actionMsg}</div>
        ) : null}

        {/* TAB: Overview */}
        {activeTab === "overview" ? (
          <>
            <Card>
              <h2 style={{ marginTop: 0 }}>{data.project.name}</h2>
              <div style={{ color: "#666" }}>{data.project.description || "No description"}</div>
              <div style={{ color: "#777", marginTop: 8 }}>
                Your role: <b>{data.membership.role}</b>
              </div>
            </Card>

            <Card>
              <h3 style={{ marginTop: 0 }}>Current Uploads</h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                <MiniCard title="Active BPMN" value={data.activeUploads.activeBpmn?.originalName ?? "None uploaded yet"} />
                <MiniCard title="Active Code ZIP" value={data.activeUploads.activeCode?.originalName ?? "None uploaded yet"} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
                <Stat label="Indexed files" value={data.counts.codeFiles} />
                <Stat label="BPMN tasks" value={data.counts.tasks} />
                <Stat label="Match results" value={data.counts.matches} />
              </div>
            </Card>

            {isAdmin ? (
              <button
                onClick={onDeleteProject}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ffd0d0",
                  background: "#fff3f3",
                  color: "#a00",
                  fontWeight: 800,
                }}
              >
                Delete Project
              </button>
            ) : null}
          </>
        ) : null}

        {/* ✅ TAB: BPMN Check (available for all users) */}
        {activeTab === "bpmnCheck" ? (
          <Card>
            <h3 style={{ marginTop: 0 }}>BPMN Check</h3>

            {/* Current uploads summary (like your template) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
              <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
                <div style={{ color: "#777" }}>Active BPMN</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {data.activeUploads.activeBpmn?.originalName ?? <span style={{ color: "#888" }}>None uploaded yet</span>}
                </div>
                {data.activeUploads.activeBpmn?.uploadedBy ? (
                  <div style={{ color: "#888", fontSize: 13, marginTop: 6 }}>
                    Uploaded by {data.activeUploads.activeBpmn.uploadedBy}
                    {data.activeUploads.activeBpmn.createdAt ? ` • ${fmtDate(data.activeUploads.activeBpmn.createdAt)}` : null}
                  </div>
                ) : null}
              </div>

              <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
                <div style={{ color: "#777" }}>Active Code ZIP</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {data.activeUploads.activeCode?.originalName ?? <span style={{ color: "#888" }}>None uploaded yet</span>}
                </div>
                {data.activeUploads.activeCode?.uploadedBy ? (
                  <div style={{ color: "#888", fontSize: 13, marginTop: 6 }}>
                    Uploaded by {data.activeUploads.activeCode.uploadedBy}
                    {data.activeUploads.activeCode.createdAt ? ` • ${fmtDate(data.activeUploads.activeCode.createdAt)}` : null}
                  </div>
                ) : null}
              </div>
            </div>

            {/* quick stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              <Stat label="Indexed files" value={data.counts.codeFiles} />
              <Stat label="BPMN tasks" value={data.counts.tasks} />
              <Stat label="Match results" value={data.counts.matches} />
            </div>

            {/* Pre-development section (only if BPMN exists) */}
            {data.activeUploads.activeBpmn ? (
              <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Pre-development</h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
                  {/* Well-Formed Check */}
                  <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
                    <div style={{ color: "#777" }}>BPMN Well-Formed Check</div>

                    {isWellFormed ? (
                      <div style={{ marginTop: 8, fontWeight: 900 }}>✅ Valid BPMN/XML</div>
                    ) : (
                      <div style={{ marginTop: 8, fontWeight: 900 }}>❌ Invalid BPMN/XML</div>
                    )}

                    {precheckWarnings.length > 0 ? (
                      <>
                        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "#777" }}>Warnings</div>
                        <pre style={codeboxStyle}>{precheckWarnings.map((w) => `- ${w}`).join("\n")}</pre>
                      </>
                    ) : null}

                    {precheckErrors.length > 0 ? (
                      <>
                        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "#777" }}>Errors</div>
                        <pre style={codeboxStyle}>{precheckErrors.map((e) => `- ${e}`).join("\n")}</pre>
                      </>
                    ) : null}

                    {precheckWarnings.length === 0 && precheckErrors.length === 0 ? (
                      <div style={{ color: "#888", marginTop: 10, fontSize: 13 }}>
                        No warnings/errors returned (or backend doesn't expose them yet).
                      </div>
                    ) : null}
                  </div>

                  {/* BPMN Summary */}
                  <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
                    <div style={{ color: "#777" }}>BPMN Summary (T5)</div>

                    {bpmnSummary ? (
                      <div style={{ marginTop: 10, fontWeight: 700, lineHeight: 1.6 }}>{bpmnSummary}</div>
                    ) : (
                      <div style={{ color: "#888", marginTop: 10 }}>No summary generated yet.</div>
                    )}

                    <div style={{ color: "#888", marginTop: 10, fontSize: 13 }}>
                      Generated from extracted process/tasks (no manual descriptions required).
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: "#888", marginTop: 12 }}>Upload a BPMN file to see well-formed check, warnings, errors, and summary.</div>
            )}
          </Card>
        ) : null}

        {/* TAB: Uploads & Tools (not admin) */}
        {activeTab === "uploads" ? (
          <Card>
            <h3 style={{ marginTop: 0 }}>Uploads & Tools</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>Upload BPMN</h4>

                {canUploadBpmn ? (
                  <>
                    <input type="file" accept=".bpmn,.xml" onChange={(e) => setBpmnFile(e.target.files?.[0] ?? null)} />
                    <button
                      onClick={onUploadBpmn}
                      disabled={!bpmnFile}
                      style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      Upload BPMN
                    </button>
                    <div style={{ color: "#888", marginTop: 8, fontSize: 13 }}>Evaluator-only.</div>
                  </>
                ) : (
                  <div style={{ color: "#888" }}>Only the evaluator can upload BPMN.</div>
                )}
              </div>

              <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>Upload Code ZIP</h4>

                {canUploadCode ? (
                  <>
                    <input type="file" accept=".zip" onChange={(e) => setCodeZip(e.target.files?.[0] ?? null)} />
                    <button
                      onClick={onUploadCode}
                      disabled={!codeZip}
                      style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      Upload & Index
                    </button>
                    <div style={{ color: "#888", marginTop: 8, fontSize: 13 }}>Allowed for evaluator and developers.</div>
                  </>
                ) : (
                  <div style={{ color: "#888" }}>You don't have permission to upload code.</div>
                )}
              </div>
            </div>

            <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
              <h4 style={{ marginTop: 0 }}>Run Analysis</h4>

              {canRunAnalysis ? (
                <>
                  <button onClick={onRunAnalysis} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
                    Run analysis
                  </button>
                  <div style={{ color: "#888", marginTop: 8, fontSize: 13 }}>Runs analysis using current active uploads.</div>
                </>
              ) : (
                <div style={{ color: "#888" }}>Only evaluator or developers can run analysis.</div>
              )}
            </div>
          </Card>
        ) : null}

        {/* TAB: Settings (evaluator only) */}
        {activeTab === "settings" ? (
          <Card>
            <h3 style={{ marginTop: 0 }}>Settings</h3>
            <div style={{ color: "#666" }}>
              Similarity threshold: <b>{data.project.similarityThreshold}</b>
            </div>

            {canUpdateThreshold ? (
              <>
                <div style={{ marginTop: 10 }}>
                  <input
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    placeholder="e.g., 0.6"
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                  <button
                    onClick={onUpdateThreshold}
                    style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    Update threshold
                  </button>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  {canManageMembers ? (
                    <Link to={`/projects/${id}/members`} style={{ textDecoration: "none" }}>
                      <button style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>Manage Members</button>
                    </Link>
                  ) : null}

                  {canViewUploadLogs ? (
                    <Link to={`/projects/${id}/logs`} style={{ textDecoration: "none" }}>
                      <button style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>Upload Logs</button>
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <div style={{ color: "#888", marginTop: 10 }}>Only evaluator can change settings and view upload logs.</div>
            )}
          </Card>
        ) : null}

        {/* TAB: Results */}
        {activeTab === "results" ? (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h3 style={{ marginTop: 0 }}>Analysis Output</h3>
              <button
                onClick={loadResults}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                disabled={resultsLoading}
              >
                {resultsLoading ? "Refreshing..." : "Refresh results"}
              </button>
            </div>

            {resultsError ? <div style={{ color: "#a00", marginTop: 8 }}>{resultsError}</div> : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              <Stat label="Tasks" value={tasks.length} />
              <Stat label="Matched" value={matched.length} />
              <Stat label="Missing" value={missing.length} />
              <Stat label="Extra" value={extra.length} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <MiniStat label="Coverage" value={`${coverage.toFixed(1)}%`} />
              <MiniStat label="Avg Similarity (matched)" value={scoreAvg.toFixed(3)} />
            </div>

            {/* Matched */}
            <SectionTable
              title="Matched"
              emptyText="No matched results yet."
              table={
                matched.length ? (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        <th style={th}>Task</th>
                        <th style={th}>Code Ref</th>
                        <th style={th}>Score</th>
                        <th style={th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matched.slice(0, 50).map((x, idx) => (
                        <tr key={`${x.task?.task_id ?? "none"}-${idx}`}>
                          <td style={td}>
                            <div style={{ fontWeight: 800 }}>{x.task?.name}</div>
                            <div style={{ color: "#888", fontSize: 12 }}>{x.task?.task_id}</div>
                          </td>
                          <td style={td}>
                            <code style={{ fontSize: 12 }}>{x.code_ref}</code>
                          </td>
                          <td style={td}>{(Number(x.similarity_score) || 0).toFixed(3)}</td>
                          <td style={td}>{x.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null
              }
            />

            {/* Missing */}
            <SectionTable
              title="Missing"
              emptyText="No missing tasks."
              table={
                missing.length ? (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        <th style={th}>Task</th>
                        <th style={th}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missing.slice(0, 50).map((t) => (
                        <tr key={t.task_id}>
                          <td style={td}>
                            <div style={{ fontWeight: 800 }}>{t.name}</div>
                            <div style={{ color: "#888", fontSize: 12 }}>{t.task_id}</div>
                          </td>
                          <td style={td}>{t.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null
              }
            />

            {/* Extra */}
            <SectionTable
              title="Extra"
              emptyText="No extra results."
              table={
                extra.length ? (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        <th style={th}>Code Ref</th>
                        <th style={th}>Score</th>
                        <th style={th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extra.slice(0, 50).map((x, idx) => (
                        <tr key={`${x.code_ref}-${idx}`}>
                          <td style={td}>
                            <code style={{ fontSize: 12 }}>{x.code_ref}</code>
                          </td>
                          <td style={td}>{(Number(x.similarity_score) || 0).toFixed(3)}</td>
                          <td style={td}>{x.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null
              }
            />

            {/* Indexed files preview */}
            <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Indexed Code Files (preview)</div>
              {files.length === 0 ? (
                <div style={{ color: "#888" }}>No files indexed yet.</div>
              ) : (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(files.slice(0, 30), null, 2)}</pre>
              )}
            </div>
          </Card>
        ) : null}

        {/* TAB: Runs */}
        {activeTab === "runs" ? (
          <Card>
            <h3 style={{ marginTop: 0 }}>Analysis Runs (latest 10)</h3>
            {data.runs.length === 0 ? (
              <div style={{ color: "#888" }}>No runs yet.</div>
            ) : (
              data.runs.map((r: ProjectDetailApi["runs"][number]) => (
                <div key={r.id} style={{ borderTop: "1px solid #eee", paddingTop: 10, marginTop: 10 }}>
                  <div style={{ fontWeight: 800 }}>
                    Run #{r.id} — {r.status}
                  </div>
                  <div style={{ color: "#888", fontSize: 13 }}>
                    Started: {r.startedAt ?? "—"} | Finished: {r.finishedAt ?? "—"}
                  </div>
                  {r.errorMessage ? <div style={{ color: "#a00", marginTop: 6 }}>Error: {r.errorMessage}</div> : null}
                </div>
              ))
            )}
          </Card>
        ) : null}

        {/* TAB: Members */}
        {activeTab === "members" ? (
          <Card>
            <h3 style={{ marginTop: 0 }}>Members</h3>
            {data.members.length === 0 ? (
              <div style={{ color: "#888" }}>No members.</div>
            ) : (
              data.members.map((m: ProjectDetailApi["members"][number]) => (
                <div key={m.id} style={{ borderTop: "1px solid #eee", paddingTop: 10, marginTop: 10 }}>
                  <div style={{ fontWeight: 800 }}>{m.username}</div>
                  <div style={{ color: "#666" }}>{m.role}</div>
                </div>
              ))
            )}
          </Card>
        ) : null}
      </section>
    </div>
  );
}

/* ---------- small helpers (keep your style) ---------- */
function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>{children}</div>;
}

function MiniCard(props: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
      <div style={{ color: "#777" }}>{props.title}</div>
      <div style={{ fontWeight: 800, marginTop: 4 }}>{props.value}</div>
    </div>
  );
}

function Stat(props: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
      <div style={{ color: "#777" }}>{props.label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{props.value}</div>
    </div>
  );
}

function MiniStat(props: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
      <div style={{ color: "#777" }}>{props.label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{props.value}</div>
    </div>
  );
}

function SectionTable(props: { title: string; emptyText: string; table: React.ReactNode | null }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{props.title}</div>
      {!props.table ? <div style={{ color: "#888" }}>{props.emptyText}</div> : props.table}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #f3f3f3" };

// ✅ NEW: code box styling (like your template)
const codeboxStyle: React.CSSProperties = {
  marginTop: 8,
  maxHeight: 160,
  overflow: "auto",
  whiteSpace: "pre-wrap",
  background: "#0b0f1a",
  color: "#e5e7eb",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #111827",
};