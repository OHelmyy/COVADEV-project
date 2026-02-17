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
  fetchCompareInputs,
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

type CompareBpmnTask = {
  taskId: string;
  name: string;
  description?: string;
  summaryText?: string;
  compareText?: string; // backward compat
};

type CompareCodeFn = {
  codeUid: string;

  // ✅ new keys
  functionName?: string;
  filePath?: string;
  summaryText?: string;

  // ✅ backward compat keys (in case backend still returns old ones)
  symbol?: string;
  file?: string;
  summary_text?: string;
  summary?: string;
  structuredSummary?: string;
};

type TabKey =
  | "overview"
  | "uploads"
  | "settings"
  | "results"
  | "compare"
  | "runs"
  | "members";

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

  // ✅ Compare state
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [bpmnCompare, setBpmnCompare] = useState<CompareBpmnTask[]>([]);
  const [codeCompare, setCodeCompare] = useState<CompareCodeFn[]>([]);

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
      { key: "uploads", label: "Uploads & Analysis", visible: !isAdmin }, // hide for admin
      {
        key: "settings",
        label: "Settings",
        visible: canUpdateThreshold || canManageMembers || canViewUploadLogs,
      },
      { key: "results", label: "Results", visible: true },
      { key: "compare", label: "Compare", visible: true },
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

  // ✅ Compare loader
  async function loadCompare() {
    if (!Number.isFinite(id)) return;
    setCompareLoading(true);
    setCompareError("");
    try {
      const res: any = await fetchCompareInputs(id);
      setBpmnCompare((res?.bpmnTasks ?? []) as CompareBpmnTask[]);
      setCodeCompare((res?.codeFunctions ?? []) as CompareCodeFn[]);
    } catch (e: any) {
      setCompareError(e?.message ?? "Failed to load compare inputs");
    } finally {
      setCompareLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    load();
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // when switching to compare tab, load compare inputs
  useEffect(() => {
    if (activeTab === "compare") loadCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  async function onUploadBpmn() {
    if (!bpmnFile) return;
    setActionMsg("Uploading BPMN...");
    try {
      await uploadBpmn(id, bpmnFile);
      setActionMsg("BPMN uploaded ✅");
      setBpmnFile(null);
      await load();
      await loadResults();
      if (activeTab === "compare") await loadCompare();
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
      if (activeTab === "compare") await loadCompare();
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
      if (activeTab === "compare") await loadCompare();
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

  async function onDeleteProject() {
    if (!window.confirm("Delete this project permanently? This cannot be undone.")) return;
    setActionMsg("Deleting project...");
    try {
      await deleteProject(id);
      setActionMsg("");
      window.location.href = "/projects";
    } catch (e: any) {
      setActionMsg(`Delete failed: ${e?.message ?? e}`);
    }
  }

  // Result groups
  const matched = useMemo(
    () => matches.filter((x) => x.task && !String(x.status).toLowerCase().includes("missing")),
    [matches]
  );

  const missing = useMemo(() => {
    const matchedTaskIds = new Set(
      matched.map((x) => x.task?.task_id).filter(Boolean) as string[]
    );
    const explicitMissing = matches.filter((x) => String(x.status).toLowerCase().includes("missing"));
    const implicitMissing = tasks.filter((t) => !matchedTaskIds.has(t.task_id));

    const map = new Map<string, { task_id: string; name: string; reason: string }>();

    explicitMissing.forEach((x) => {
      if (x.task)
        map.set(x.task.task_id, { task_id: x.task.task_id, name: x.task.name, reason: "Marked missing" });
    });

    implicitMissing.forEach((t) => {
      if (!map.has(t.task_id))
        map.set(t.task_id, { task_id: t.task_id, name: t.name, reason: "No match found" });
    });

    return Array.from(map.values());
  }, [tasks, matches, matched]);

  const extra = useMemo(
    () => matches.filter((x) => !x.task || String(x.status).toLowerCase().includes("extra")),
    [matches]
  );

  const scoreAvg = useMemo(() => {
    if (matched.length === 0) return 0;
    const s = matched.reduce((acc, x) => acc + (Number(x.similarity_score) || 0), 0);
    return s / matched.length;
  }, [matched]);

  const coverage = useMemo(() => {
    if (tasks.length === 0) return 0;
    const matchedTaskIds = new Set(
      matched.map((x) => x.task?.task_id).filter(Boolean) as string[]
    );
    return (matchedTaskIds.size / tasks.length) * 100;
  }, [tasks, matched]);

  if (state === "loading" || state === "idle") return <StatusMessage title="Loading project..." />;
  if (state === "error")
    return <StatusMessage title="Failed to load project" message={errorText} onRetry={load} />;
  if (!data) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        gap: 14,
        alignItems: "start",
      }}
    >
      {/* LEFT MENU */}
      <aside
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          background: "#fff",
          padding: 10,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            padding: "10px 10px",
            borderBottom: "1px solid #f3f3f3",
          }}
        >
          Project
        </div>

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
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fff" }}>
            {actionMsg}
          </div>
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

        {/* TAB: Uploads & Tools */}
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
                  <button
                    onClick={onRunAnalysis}
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    Run analysis
                  </button>
                  <div style={{ color: "#888", marginTop: 8, fontSize: 13 }}>
                    Runs analysis using current active uploads.
                  </div>
                </>
              ) : (
                <div style={{ color: "#888" }}>Only evaluator or developers can run analysis.</div>
              )}
            </div>
          </Card>
        ) : null}

        {/* TAB: Settings */}
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
                      <button style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
                        Manage Members
                      </button>
                    </Link>
                  ) : null}

                  {canViewUploadLogs ? (
                    <Link to={`/projects/${id}/logs`} style={{ textDecoration: "none" }}>
                      <button style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
                        Upload Logs
                      </button>
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <div style={{ color: "#888", marginTop: 10 }}>
                Only evaluator can change settings and view upload logs.
              </div>
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

            <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Indexed Code Files (preview)</div>
              {files.length === 0 ? (
                <div style={{ color: "#888" }}>No files indexed yet.</div>
              ) : (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(files.slice(0, 30), null, 2)}
                </pre>
              )}
            </div>
          </Card>
        ) : null}

        {/* ✅ TAB: Compare */}
{activeTab === "compare" ? (
  <Card>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Compare Inputs (What the system compares)
      </h3>
      <button
        onClick={loadCompare}
        style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        disabled={compareLoading}
      >
        {compareLoading ? "Refreshing..." : "Refresh compare"}
      </button>
    </div>

    {compareError ? (
      <div style={{ color: "#a00", marginTop: 8 }}>{compareError}</div>
    ) : null}

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
      {/* BPMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>BPMN Task Summaries</div>

        {bpmnCompare.length === 0 ? (
          <div style={{ color: "#888" }}>No BPMN tasks yet.</div>
        ) : (
          bpmnCompare.map((t) => {
            const body =
              (t.summaryText && t.summaryText.trim()) ||
              // لو لسه API بيرجع compareText (compat)
              ((t as any).compareText && String((t as any).compareText).trim()) ||
              `Task: ${t.name || "Unnamed Task"}. Description: ${t.description || ""}`;

            return (
              <CompareCard
                key={t.taskId}
                title={t.name || "Unnamed Task"}
                subtitle={t.taskId}
                body={body}
              />
            );
          })
        )}
      </div>

      {/* Code */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Code Function Summaries</div>

        {codeCompare.length === 0 ? (
          <div style={{ color: "#888" }}>No code summaries yet.</div>
        ) : (
          codeCompare.map((c: any) => {
            const fnName =
              (c.functionName && String(c.functionName).trim()) ||
              (c.symbol && String(c.symbol).trim()) ||
              "Unnamed Function";

            const fp =
              (c.filePath && String(c.filePath).trim()) ||
              (c.file && String(c.file).trim()) ||
              "";

            const subtitle = fp ? `${c.codeUid} — ${fp}` : `${c.codeUid}`;

            // ✅ أهم نقطة: body يبقى نفس فورمات BPMN
            // لو backend رجّع summaryText جاهز بصيغة "Task: ... Description: ..."
            const sumRaw =
              (c.summaryText && String(c.summaryText).trim()) ||
              (c.summary_text && String(c.summary_text).trim()) ||
              (c.summary && String(c.summary).trim()) ||
              "";

            const humanTitle = humanizeTitle(fnName);

            const body =
              sumRaw && sumRaw.startsWith("Task:") && sumRaw.includes("Description:")
                ? sumRaw
                : `Task: ${humanTitle || "Unnamed function"}. Description: ${
                    sumRaw || "No summary generated for this function."
                  }`;

            return (
              <CompareCard
                key={c.codeUid}
                title={fnName}
                subtitle={subtitle}
                body={body}
              />
            );
          })
        )}
      </div>
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

/* ---------- small helpers ---------- */
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

function CompareCard(props: { title: string; subtitle: string; body: string }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, background: "#fff" }}>
      <div style={{ fontWeight: 900, fontSize: 16 }}>{props.title}</div>
      <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{props.subtitle}</div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45 }}>{props.body}</div>
    </div>
  );
}
function humanizeTitle(s: string) {
  const t = String(s || "").replace(/_/g, " ").trim();
  if (!t) return "";
  return t[0].toUpperCase() + t.slice(1);
}


const th: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #f3f3f3" };
