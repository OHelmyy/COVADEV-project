import { useState } from "react";
import { ui, inputBase } from "../../../../../theme/ui";
import { Card } from "../ProjectUi";

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
  githubRepoUrl?: string;
  onFetchGithubCode: (branch: string) => void;
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
  githubRepoUrl,
  onFetchGithubCode,
}: Props) {
  const [branch, setBranch] = useState("main");
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
        </div>

        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
          <h4 style={{ marginTop: 0 }}>Fetch from GitHub</h4>

          {canUploadCode ? (
            githubRepoUrl ? (
              <>
                <div style={{ color: ui.colors.textMuted, fontSize: 13, marginBottom: 8 }}>
                  Repo: <span style={{ color: ui.colors.text }}>{githubRepoUrl}</span>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>Branch</span>
                  <input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    style={{ ...inputBase, width: "100%", padding: "6px 10px" }}
                    placeholder="main"
                  />
                </div>
                <button
                  onClick={() => onFetchGithubCode(branch)}
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    width: "100%",
                  }}
                >
                  Fetch & Index
                </button>
              </>
            ) : (
              <div style={{ color: "#888", fontSize: 13 }}>
                No GitHub repository linked. Add one in the <b>Overview</b> tab settings.
              </div>
            )
          ) : (
            <div style={{ color: "#888" }}>You don't have permission to fetch code.</div>
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