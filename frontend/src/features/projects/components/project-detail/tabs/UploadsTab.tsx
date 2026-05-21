import { useState } from "react";
import { Card } from "../ProjectUi";
import { fetchAndIndexGitHubBranch } from "../../../../../api/github";
import { ui } from "../../../../../theme/ui";

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
    } catch (err: any) {
      setGithubMsg(err.message || "Failed to fetch from GitHub");
    } finally {
      setFetchingGithub(false);
    }
  };

  const panelStyle: React.CSSProperties = {
    border: `1px solid ${ui.colors.border}`,
    borderRadius: ui.radius.lg,
    padding: 16,
    background: "#fff",
    boxShadow: ui.shadow.sm,
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    color: ui.colors.text,
  };

  const descStyle: React.CSSProperties = {
    color: ui.colors.textMuted,
    fontSize: 13,
    lineHeight: 1.6,
    marginTop: 6,
  };

  const buttonStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: ui.radius.md,
    border: `1px solid ${ui.colors.border}`,
    background: "#fff",
    color: ui.colors.text,
    fontWeight: 800,
    cursor: "pointer",
    transition: ui.transition,
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: ui.colors.primary,
    color: "#fff",
    border: `1px solid ${ui.colors.primary}`,
  };

  const disabledButtonStyle: React.CSSProperties = {
    opacity: 0.55,
    cursor: "not-allowed",
  };

  const fileBoxStyle: React.CSSProperties = {
    marginTop: 14,
    padding: 14,
    border: `1px dashed ${ui.colors.border}`,
    borderRadius: ui.radius.md,
    background: ui.colors.bgSoft,
  };

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "flex-start",
          marginBottom: 18,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 900,
              color: ui.colors.text,
            }}
          >
            Uploads & Analysis
          </h3>


        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <div style={panelStyle}>
          <h4 style={titleStyle}>1. BPMN Model</h4>


          {canUploadBpmn ? (
            <div style={fileBoxStyle}>
              <input
                type="file"
                accept=".bpmn,.xml"
                onChange={(e) => setBpmnFile(e.target.files?.[0] ?? null)}
                style={{ width: "100%" }}
              />

              {bpmnFile && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    color: ui.colors.text,
                    fontWeight: 700,
                    wordBreak: "break-word",
                  }}
                >
                  Selected: {bpmnFile.name}
                </div>
              )}

              <button
                onClick={onUploadBpmn}
                disabled={!bpmnFile}
                style={{
                  ...primaryButtonStyle,
                  ...(bpmnFile ? {} : disabledButtonStyle),
                  width: "100%",
                  marginTop: 12,
                }}
              >
                Upload BPMN
              </button>

              <div style={descStyle}>Evaluator-only upload.</div>
            </div>
          ) : (
            <div style={{ ...fileBoxStyle, color: ui.colors.textMuted, fontSize: 14 }}>
              Only the evaluator can upload BPMN files.
            </div>
          )}
        </div>

        <div style={panelStyle}>
          <h4 style={titleStyle}>2. Code Source</h4>


          {canUploadCode ? (
            <>
              <div style={fileBoxStyle}>
                <div
                  style={{
                    fontWeight: 900,
                    color: ui.colors.text,
                    marginBottom: 10,
                    fontSize: 14,
                  }}
                >
                  Upload Code ZIP
                </div>

                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setCodeZip(e.target.files?.[0] ?? null)}
                  style={{ width: "100%" }}
                />

                {codeZip && (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: ui.colors.text,
                      fontWeight: 700,
                      wordBreak: "break-word",
                    }}
                  >
                    Selected: {codeZip.name}
                  </div>
                )}

                <button
                  onClick={onUploadCode}
                  disabled={!codeZip}
                  style={{
                    ...primaryButtonStyle,
                    ...(codeZip ? {} : disabledButtonStyle),
                    width: "100%",
                    marginTop: 12,
                  }}
                >
                  Upload & Index Code
                </button>
              </div>

              <div
                style={{
                  marginTop: 14,
                  paddingTop: 16,
                  borderTop: `1px dashed ${ui.colors.border}`,
                }}
              >
                <h5
                  style={{
                    marginTop: 0,
                    marginBottom: 10,
                    color: ui.colors.text,
                    fontSize: 15,
                    fontWeight: 900,
                  }}
                >
                  Or fetch from GitHub
                </h5>

                <button
                  onClick={handleFetchGithub}
                  disabled={fetchingGithub}
                  style={{
                    ...primaryButtonStyle,
                    ...(fetchingGithub ? disabledButtonStyle : {}),
                    width: "100%",
                  }}
                >
                  {fetchingGithub ? "Fetching..." : "Fetch 'main' Branch & Index"}
                </button>

                {githubMsg && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      color: githubMsg.includes("Failed")
                        ? ui.colors.danger
                        : ui.colors.primary,
                    }}
                  >
                    {githubMsg}
                  </div>
                )}

                <div style={descStyle}>
                  Requires GitHub to be connected in Tasks &amp; Submissions -&gt; GitHub.
                </div>
              </div>
            </>
          ) : (
            <div style={{ ...fileBoxStyle, color: ui.colors.textMuted, fontSize: 14 }}>
              You do not have permission to upload or fetch code.
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          border: `1px solid ${ui.colors.primary}`,
          borderRadius: ui.radius.lg,
          padding: 18,
          background: `linear-gradient(180deg, ${ui.colors.primarySoft} 0%, #ffffff 100%)`,
          boxShadow: ui.shadow.sm,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: 19,
                fontWeight: 900,
                color: ui.colors.text,
              }}
            >
              3. Run Analysis
            </h4>
          </div>

          {canRunAnalysis ? (
            <button
              onClick={onRunAnalysis}
              style={{
                ...primaryButtonStyle,
                padding: "14px 24px",
                fontSize: 15,
                minWidth: 180,
                boxShadow: ui.shadow.sm,
              }}
            >
              Run Analysis
            </button>
          ) : (
            <div
              style={{
                color: ui.colors.textMuted,
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Only evaluators or developers can run analysis.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}