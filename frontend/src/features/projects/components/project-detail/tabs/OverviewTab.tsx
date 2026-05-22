import { useState } from "react";
import { ui, inputBase } from "../../../../../theme/ui";
import { Card, MiniCard, Stat } from "../ProjectUi";

type IndexedFile = {
  id?: number;
  name?: string | null;
  originalName?: string | null;
  path?: string | null;
  filePath?: string | null;
  type?: string | null;
};

type Props = {
  projectName: string;
  description?: string | null;
  role: string;
  isAdmin: boolean;
  activeBpmnName?: string | null;
  activeCodeName?: string | null;
  codeFilesCount: number;
  indexedFiles: IndexedFile[];
  tasksCount: number;
  matchesCount: number;
  githubRepoUrl?: string;
  onUpdateGithubUrl: (url: string) => void;
  onDeleteProject: () => void;
};

function normalizePath(value?: string | null) {
  return (value || "").replace(/\\/g, "/");
}

function cleanFileName(value?: string | null) {
  const clean = normalizePath(value);

  if (!clean) return "";

  return clean.split("/").pop() || clean;
}

function getIndexedFileName(file: IndexedFile) {
  const name =
    cleanFileName(file.name) ||
    cleanFileName(file.originalName) ||
    cleanFileName(file.path) ||
    cleanFileName(file.filePath);

  if (name && !/^\d+$/.test(name)) {
    return name;
  }

  return file.id ? `Code File #${file.id}` : "Unknown code file";
}

function getIndexedFilePath(file: IndexedFile) {
  const cleanPath = normalizePath(file.path || file.filePath || file.originalName || file.name);

  if (!cleanPath) return "";

  const parts = cleanPath.split("/");

  if (parts.length <= 1) return "";

  parts.pop();
  return parts.join("/");
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "py") return "🐍";
  if (["js", "jsx"].includes(ext || "")) return "🟨";
  if (["ts", "tsx"].includes(ext || "")) return "🔷";
  if (ext === "java") return "☕";
  if (ext === "cs") return "🟪";
  if (ext === "php") return "🐘";

  return "📄";
}

export default function OverviewTab({
  projectName,
  description,
  role,
  isAdmin,
  activeBpmnName,
  activeCodeName,
  codeFilesCount,
  indexedFiles,
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Indexed Code Files</h3>
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                color: ui.colors.textMuted,
              }}
            >
              Files extracted from the active code upload.
            </div>
          </div>

          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "#f1f5f9",
              color: ui.colors.textMuted,
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {indexedFiles.length} files
          </div>
        </div>

        {indexedFiles.length === 0 ? (
          <div
            style={{
              border: "1px dashed #cbd5e1",
              borderRadius: 14,
              padding: 16,
              background: "#f8fafc",
              color: ui.colors.textMuted,
              fontSize: 13,
            }}
          >
            No indexed code files available yet. Upload or analyze code to show files here.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {indexedFiles.map((file, index) => {
              const fileName = getIndexedFileName(file);
              const folderPath = getIndexedFilePath(file);

              return (
                <div
                  key={file.id ?? `${file.path ?? file.name ?? "file"}-${index}`}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 14,
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: "#f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      {getFileIcon(fileName)}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        title={fileName}
                        style={{
                          fontWeight: 900,
                          color: ui.colors.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {fileName}
                      </div>

                      <div
                        title={folderPath || "Root folder"}
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: ui.colors.textMuted,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {folderPath || "Root folder"}
                      </div>
                    </div>
                  </div>

                  {file.type ? (
                    <div
                      style={{
                        marginTop: 12,
                        fontSize: 11,
                        fontWeight: 800,
                        color: ui.colors.primary,
                        background: "#eff6ff",
                        padding: "4px 8px",
                        borderRadius: 999,
                        display: "inline-block",
                        textTransform: "uppercase",
                      }}
                    >
                      {file.type}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
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
            <div
              style={{
                fontSize: 12,
                color: ui.colors.primary,
                fontWeight: 600,
              }}
            >
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