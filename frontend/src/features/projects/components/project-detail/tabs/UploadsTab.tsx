import { useState } from "react";
import { Card } from "../ProjectUi";
import { fetchAndIndexGitHubBranch } from "../../../../../api/github";

type Props = {
  canUploadBpmn: boolean;
  canUploadCode: boolean;
  canRunAnalysis: boolean;
  bpmnFile: File | null;
  codeZip: File | null;
  setBpmnFile: (file: File | null) => void;
  setCodeZip: (file: File | null) => void;
  onUploadBpmn: () => void;
  onUploadCode: () => void;
  onRunAnalysis: () => void;
  projectId: number;
};

export default function UploadsTab({
  canUploadBpmn,
  canUploadCode,
  canRunAnalysis,
  bpmnFile,
  codeZip,
  setBpmnFile,
  setCodeZip,
  onUploadBpmn,
  onUploadCode,
  onRunAnalysis,
  projectId,
}: Props) {
  const [fetchingGithub, setFetchingGithub] = useState(false);
  const [githubMsg, setGithubMsg] = useState("");

  const handleFetchGithub = async () => {
    setFetchingGithub(true);
    setGithubMsg("");
    try {
      const res = await fetchAndIndexGitHubBranch(projectId, "main");
      setGithubMsg(res.message || "Successfully fetched and indexed main branch");
      // Optional: you might want to reload project data here, but user can refresh.
    } catch (err: any) {
      setGithubMsg(err.message || "Failed to fetch from GitHub");
    } finally {
      setFetchingGithub(false);
    }
  };
  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Uploads & Tools</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 12,
        }}
      >
        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
          <h4 style={{ marginTop: 0 }}>Upload BPMN</h4>

          {canUploadBpmn ? (
            <>
              <input
                type="file"
                accept=".bpmn,.xml"
                onChange={(e) => setBpmnFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={onUploadBpmn}
                disabled={!bpmnFile}
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              >
                Upload BPMN
              </button>
              <div style={{ color: "#888", marginTop: 8, fontSize: 13 }}>
                Evaluator-only.
              </div>
            </>
          ) : (
            <div style={{ color: "#888" }}>Only the evaluator can upload BPMN.</div>
          )}
        </div>

        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
          <h4 style={{ marginTop: 0 }}>Upload Code ZIP</h4>

          {canUploadCode ? (
            <>
              <input
                type="file"
                accept=".zip"
                onChange={(e) => setCodeZip(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={onUploadCode}
                disabled={!codeZip}
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              >
                Upload & Index
              </button>
              <div style={{ color: "#888", marginTop: 8, fontSize: 13 }}>
                Allowed for evaluator and developers.
              </div>
            </>
          ) : (
            <div style={{ color: "#888" }}>You don't have permission to upload code.</div>
          )}

          {canUploadCode && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed #ddd" }}>
              <h5 style={{ marginTop: 0, marginBottom: 10 }}>Or fetch from GitHub</h5>
              <button
                onClick={handleFetchGithub}
                disabled={fetchingGithub}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              >
                {fetchingGithub ? "Fetching..." : "Fetch 'main' Branch & Index"}
              </button>
              {githubMsg && <div style={{ marginTop: 8, fontSize: 13, color: githubMsg.includes("Failed") ? "red" : "green" }}>{githubMsg}</div>}
              <div style={{ color: "#888", marginTop: 8, fontSize: 13 }}>
                Requires GitHub to be connected in Tasks &amp; Submissions -&gt; GitHub.
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #f0f0f0",
          borderRadius: 12,
          padding: 12,
          marginTop: 12,
        }}
      >
        <h4 style={{ marginTop: 0 }}>Run Analysis</h4>

        {canRunAnalysis ? (
          <>
            <button
              onClick={onRunAnalysis}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
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
  );
}