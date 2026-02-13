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

  // ✅ Results state (inside component)
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [resultsError, setResultsError] = useState<string>("");
  const [resultsLoading, setResultsLoading] = useState<boolean>(false);

  const isEvaluator = data?.membership.role === "EVALUATOR";

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
      await loadResults(); // ✅ show results after run
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

  // ✅ Derive detailed groups
  const matched = useMemo(() => {
    return matches.filter((x) => x.task && !String(x.status).toLowerCase().includes("missing"));
  }, [matches]);

  const missing = useMemo(() => {
    const matchedTaskIds = new Set(matched.map((x) => x.task?.task_id).filter(Boolean) as string[]);
    const explicitMissing = matches.filter((x) => String(x.status).toLowerCase().includes("missing"));
    const implicitMissing = tasks.filter((t) => !matchedTaskIds.has(t.task_id));

    const map = new Map<string, { task_id: string; name: string; reason: string }>();

    explicitMissing.forEach((x) => {
      if (x.task)
        map.set(x.task.task_id, { task_id: x.task.task_id, name: x.task.name, reason: "Marked missing" });
    });

    implicitMissing.forEach((t) => {
      if (!map.has(t.task_id)) map.set(t.task_id, { task_id: t.task_id, name: t.name, reason: "No match found" });
    });

    return Array.from(map.values());
  }, [tasks, matches, matched]);

  const extra = useMemo(() => {
    return matches.filter((x) => !x.task || String(x.status).toLowerCase().includes("extra"));
  }, [matches]);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>{data.project.name}</h2>
        <div style={{ color: "#666" }}>{data.project.description || "No description"}</div>
        <div style={{ color: "#777", marginTop: 8 }}>
          Your role: <b>{data.membership.role}</b>
        </div>
      </div>

      {/* Action message */}
      {actionMsg ? (
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fff" }}>{actionMsg}</div>
      ) : null}

      {/* Current Uploads + Stats */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Current Uploads</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
          <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
            <div style={{ color: "#777" }}>Active BPMN</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>
              {data.activeUploads.activeBpmn?.originalName ?? <span style={{ color: "#888" }}>None uploaded yet</span>}
            </div>
          </div>

          <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
            <div style={{ color: "#777" }}>Active Code ZIP</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>
              {data.activeUploads.activeCode?.originalName ?? <span style={{ color: "#888" }}>None uploaded yet</span>}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          <Stat label="Indexed files" value={data.counts.codeFiles} />
          <Stat label="BPMN tasks" value={data.counts.tasks} />
          <Stat label="Match results" value={data.counts.matches} />
        </div>
      </div>

      {/* Tools */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Tools</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          {/* BPMN Upload evaluator only */}
          <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
            <h4 style={{ marginTop: 0 }}>Upload BPMN</h4>

            {isEvaluator ? (
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

          {/* Code ZIP any member */}
          <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
            <h4 style={{ marginTop: 0 }}>Upload Code ZIP</h4>
            <input type="file" accept=".zip" onChange={(e) => setCodeZip(e.target.files?.[0] ?? null)} />
            <button
              onClick={onUploadCode}
              disabled={!codeZip}
              style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            >
              Upload & Index
            </button>
            <div style={{ color: "#888", marginTop: 8, fontSize: 13 }}>Allowed for evaluator and developers.</div>
          </div>
        </div>

        {/* Run analysis */}
        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
          <h4 style={{ marginTop: 0 }}>Run Analysis</h4>
          <button onClick={onRunAnalysis} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
            Run analysis
          </button>
          <div style={{ color: "#888", marginTop: 8, fontSize: 13 }}>Runs analysis using current active uploads.</div>
        </div>
      </div>

      {/* Settings */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>
        <div style={{ color: "#666" }}>
          Similarity threshold: <b>{data.project.similarityThreshold}</b>
        </div>

        {isEvaluator ? (
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
              <Link to={`/projects/${id}/members`} style={{ textDecoration: "none" }}>
                <button style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>Manage Members</button>
              </Link>
              <Link to={`/projects/${id}/logs`} style={{ textDecoration: "none" }}>
                <button style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>Upload Logs</button>
              </Link>
            </div>
          </>
        ) : (
          <div style={{ color: "#888", marginTop: 10 }}>Only evaluator can change settings and view upload logs.</div>
        )}
      </div>

      {/* ✅ Detailed Results */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
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
          <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
            <div style={{ color: "#777" }}>Coverage</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{coverage.toFixed(1)}%</div>
          </div>
          <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
            <div style={{ color: "#777" }}>Avg Similarity (matched)</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{scoreAvg.toFixed(3)}</div>
          </div>
        </div>

        {/* Matched */}
        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Matched</div>
          {matched.length === 0 ? (
            <div style={{ color: "#888" }}>No matched results yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Task</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Code Ref</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Score</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {matched.slice(0, 50).map((x, idx) => (
                  <tr key={`${x.task?.task_id ?? "none"}-${idx}`}>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      <div style={{ fontWeight: 800 }}>{x.task?.name}</div>
                      <div style={{ color: "#888", fontSize: 12 }}>{x.task?.task_id}</div>
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      <code style={{ fontSize: 12 }}>{x.code_ref}</code>
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      {(Number(x.similarity_score) || 0).toFixed(3)}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>{x.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Missing */}
        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Missing</div>
          {missing.length === 0 ? (
            <div style={{ color: "#888" }}>No missing tasks.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Task</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {missing.slice(0, 50).map((t) => (
                  <tr key={t.task_id}>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      <div style={{ fontWeight: 800 }}>{t.name}</div>
                      <div style={{ color: "#888", fontSize: 12 }}>{t.task_id}</div>
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>{t.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Extra */}
        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Extra</div>
          {extra.length === 0 ? (
            <div style={{ color: "#888" }}>No extra results.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Code Ref</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Score</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {extra.slice(0, 50).map((x, idx) => (
                  <tr key={`${x.code_ref}-${idx}`}>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      <code style={{ fontSize: 12 }}>{x.code_ref}</code>
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      {(Number(x.similarity_score) || 0).toFixed(3)}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>{x.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Indexed files preview */}
        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Indexed Code Files (preview)</div>
          {files.length === 0 ? (
            <div style={{ color: "#888" }}>No files indexed yet.</div>
          ) : (
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(files.slice(0, 30), null, 2)}</pre>
          )}
        </div>
      </div>

      {/* Runs history */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
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
      </div>

      {/* Members list */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
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
      </div>
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
