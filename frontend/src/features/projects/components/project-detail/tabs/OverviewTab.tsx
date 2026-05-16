import { useState } from "react";
import { ui, inputBase } from "../../../../../theme/ui";
import { Card, MiniCard, Stat } from "../ProjectUi";

type Props = {
  projectName: string;
  description?: string | null;
  role: string;
  isAdmin: boolean;
  activeBpmnName?: string | null;
  activeCodeName?: string | null;
  codeFilesCount: number;
  tasksCount: number;
  matchesCount: number;
  githubRepoUrl?: string;
  onUpdateGithubUrl: (url: string) => void;
  onDeleteProject: () => void;
};

export default function OverviewTab({
  projectName,
  description,
  role,
  isAdmin,
  activeBpmnName,
  activeCodeName,
  codeFilesCount,
  tasksCount,
  matchesCount,
  githubRepoUrl,
  onUpdateGithubUrl,
  onDeleteProject,
}: Props) {
  const [newUrl, setNewUrl] = useState(githubRepoUrl || "");
  const isEvaluatorOrAdmin = role === "EVALUATOR" || isAdmin;
  return (
    <>
      <Card>
        <h2 style={{ marginTop: 0 }}>{projectName}</h2>
        <div style={{ color: "#666" }}>{description || "No description"}</div>
        <div style={{ color: "#777", marginTop: 8 }}>
          Your role: <b>{role}</b>
        </div>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>Current Uploads</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 10,
          }}
        >
          <MiniCard
            title="Active BPMN"
            value={activeBpmnName ?? "None uploaded yet"}
          />
          <MiniCard
            title="Active Code ZIP"
            value={activeCodeName ?? "None uploaded yet"}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            marginTop: 12,
          }}
        >
          <Stat label="Indexed files" value={codeFilesCount} />
          <Stat label="BPMN tasks" value={tasksCount} />
          <Stat label="Match results" value={matchesCount} />
        </div>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>GitHub Settings</h3>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ fontSize: 13, color: ui.colors.textMuted }}>
            Link a public GitHub repository to pull code directly from branches.
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              disabled={!isEvaluatorOrAdmin}
              placeholder="https://github.com/owner/repo"
              style={{ ...inputBase, flex: 1 }}
            />
            {isEvaluatorOrAdmin && (
              <button
                onClick={() => onUpdateGithubUrl(newUrl)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 12,
                  background: ui.colors.primary,
                  color: "#fff",
                  fontWeight: 700,
                  border: "none",
                }}
              >
                Update
              </button>
            )}
          </div>
          {githubRepoUrl && (
            <div style={{ fontSize: 12, color: ui.colors.primary, fontWeight: 600 }}>
              Currently linked: {githubRepoUrl}
            </div>
          )}
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
  );
}