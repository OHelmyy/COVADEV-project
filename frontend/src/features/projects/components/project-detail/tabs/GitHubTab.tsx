import React, { useState, useEffect } from "react";
import { Card } from "../ProjectUi";
import {
  connectGitHub,
  fetchGitHubRepo,
  fetchGitHubBranches,
  fetchGitHubPullRequests,
  fetchGitHubPullRequestFiles,
  fetchGitHubFileContent,
  createGitHubBranch,
  mergeGitHubPullRequest
} from "../../../../../api/github";
import type {
  GitHubRepoApi,
  GitHubBranchApi,
  GitHubPullRequestApi,
  GitHubFileApi,
  GitHubFileContentApi
} from "../../../../../api/github";

type Props = {
  projectId: number;
  isAdmin?: boolean;
};

export default function GitHubTab({ projectId, isAdmin }: Props) {
  const [repo, setRepo] = useState<GitHubRepoApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [owner, setOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Data state
  const [branches, setBranches] = useState<GitHubBranchApi[]>([]);
  const [prs, setPrs] = useState<GitHubPullRequestApi[]>([]);
  const [selectedPr, setSelectedPr] = useState<GitHubPullRequestApi | null>(null);
  const [prFiles, setPrFiles] = useState<GitHubFileApi[]>([]);
  const [selectedFile, setSelectedFile] = useState<GitHubFileApi | null>(null);
  const [fileContent, setFileContent] = useState<GitHubFileContentApi | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Branch creation state
  const [newBranchName, setNewBranchName] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    loadRepo();
  }, [projectId]);

  const loadRepo = async () => {
    setLoading(true);
    try {
      const data = await fetchGitHubRepo(projectId);
      setRepo(data);
      loadRepoData();
    } catch (err) {
      setRepo(null);
    } finally {
      setLoading(false);
    }
  };

  const loadRepoData = async () => {
    try {
      const [branchesData, prsData] = await Promise.all([
        fetchGitHubBranches(projectId),
        fetchGitHubPullRequests(projectId)
      ]);
      setBranches(branchesData);
      setPrs(prsData);
    } catch (err) {
      console.error("Failed to load repo data", err);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setError(null);
    try {
      const data = await connectGitHub(projectId, {
        owner,
        repo_name: repoName,
        access_token: token
      });
      setRepo(data);
      loadRepoData();
    } catch (err: any) {
      setError(err.message || "Failed to connect to GitHub");
    } finally {
      setConnecting(false);
    }
  };

  const handleViewPr = async (pr: GitHubPullRequestApi) => {
    setSelectedPr(pr);
    setSelectedFile(null);
    setFileContent(null);
    try {
      const files = await fetchGitHubPullRequestFiles(projectId, pr.number);
      setPrFiles(files);
    } catch (err) {
      console.error("Failed to load PR files", err);
    }
  };

  const handleViewFile = async (file: GitHubFileApi) => {
    setSelectedFile(file);
    setLoadingContent(true);
    try {
      // Use the head SHA of the PR to get the file content
      const content = await fetchGitHubFileContent(projectId, file.filename, selectedPr?.head.sha);
      setFileContent(content);
    } catch (err) {
      console.error("Failed to load file content", err);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const branchName = newBranchName.trim();
    if (!branchName) return;

    // Find the default branch to get its SHA
    if (branches.length === 0) {
      alert("No branches found in this repository.");
      return;
    }
    const baseBranch = branches.find(b => b.name === repo?.default_branch) || branches[0];
    if (!baseBranch) {
      alert("No base branch found to create from.");
      return;
    }

    setCreatingBranch(true);
    try {
      await createGitHubBranch(projectId, branchName, baseBranch.commit.sha);
      setNewBranchName("");
      loadRepoData(); // Refresh branches list
      alert(`Branch '${branchName}' created successfully!`);
    } catch (err: any) {
      alert(err.message || "Failed to create branch");
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleMergePr = async () => {
    if (!selectedPr) return;
    const ok = window.confirm(`Are you sure you want to merge Pull Request #${selectedPr.number} directly from COVADEV?`);
    if (!ok) return;

    setMerging(true);
    try {
      await mergeGitHubPullRequest(projectId, selectedPr.number);
      alert(`Pull Request #${selectedPr.number} merged successfully!`);
      setSelectedPr(null);
      loadRepoData();
    } catch (err: any) {
      alert(err.message || "Failed to merge Pull Request.");
    } finally {
      setMerging(false);
    }
  };

  if (loading) return <div>Loading GitHub integration...</div>;

  if (!repo) {
    return (
      <Card>
        <h3 style={{ marginTop: 0 }}>Connect GitHub Repository</h3>
        <p style={{ color: "#666" }}>
          Link this project to a GitHub repository to track development progress and evaluate tasks.
        </p>

        <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Repository Owner</label>
            <input
              type="text"
              placeholder="e.g. facebook"
              value={owner}
              onChange={e => setOwner(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Repository Name</label>
            <input
              type="text"
              placeholder="e.g. react"
              value={repoName}
              onChange={e => setRepoName(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Personal Access Token</label>
            <input
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={token}
              onChange={e => setToken(e.target.value)}
              required
              style={inputStyle}
            />
            <small style={{ color: "#888" }}>Token is stored securely and never exposed to the frontend.</small>
          </div>

          {error && <div style={{ color: "#ff4d4f", fontSize: 14 }}>{error}</div>}

          <button
            type="submit"
            disabled={connecting}
            style={buttonStyle}
          >
            {connecting ? "Connecting..." : "Connect Repository"}
          </button>
        </form>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Card>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Repository</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/github-mark.png" alt="GitHub" style={{ width: 20, height: 20, opacity: 0.7 }} onError={(e) => (e.currentTarget.style.display = 'none')} />
            <a href={repo.github_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "#0969da", textDecoration: "none" }}>
              {repo.owner}/{repo.repo_name}
            </a>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
            Default Branch: <strong>{repo.default_branch}</strong>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Branches ({branches.length})</h3>

          <form onSubmit={handleCreateBranch} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="New branch name"
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }}
            />
            <button
              type="submit"
              disabled={creatingBranch || !newBranchName}
              style={{ ...buttonStyle, padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}
            >
              {creatingBranch ? "..." : "Create"}
            </button>
          </form>

          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {branches.map(b => (
              <div key={b.name} style={{ fontSize: 13, padding: "4px 8px", background: "#f6f8fa", borderRadius: 4, border: "1px solid #d0d7de" }}>
                {b.name}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Pull Requests ({prs.length})</h3>
          <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {prs.map(pr => (
              <div
                key={pr.number}
                onClick={() => handleViewPr(pr)}
                style={{
                  fontSize: 13,
                  padding: 8,
                  background: selectedPr?.number === pr.number ? "#f0f7ff" : "#fff",
                  borderRadius: 6,
                  border: selectedPr?.number === pr.number ? "1px solid #0969da" : "1px solid #d0d7de",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ fontWeight: 600 }}>#{pr.number} {pr.title}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                  by {pr.user.login} • {new Date(pr.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {selectedPr ? (
          <>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ marginTop: 0, marginBottom: 4 }}>{selectedPr.title}</h2>
                  <div style={{ color: "#666", fontSize: 14 }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: selectedPr.state === "open" ? "#2da44e" : "#8250df",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      marginRight: 8
                    }}>
                      {selectedPr.state.toUpperCase()}
                    </span>
                    #{selectedPr.number} • {selectedPr.user.login} wants to merge {selectedPr.head.ref} into {selectedPr.base.ref}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <a href={selectedPr.html_url} target="_blank" rel="noreferrer" style={linkButtonStyle}>
                    View on GitHub
                  </a>
                  {selectedPr.state === "open" && !isAdmin && (
                    <button
                      onClick={handleMergePr}
                      disabled={merging}
                      style={{
                        ...buttonStyle,
                        background: "linear-gradient(135deg, #2da44e 0%, #22c55e 100%)",
                        padding: "8px 16px",
                        fontSize: 14,
                        borderRadius: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 2px 4px rgba(45, 164, 78, 0.2)",
                        border: "none",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {merging ? "Merging..." : "✅ Accept & Merge PR"}
                    </button>
                  )}
                </div>
              </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
              <Card>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>Changed Files ({prFiles.length})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {prFiles.map(f => (
                    <div
                      key={f.filename}
                      onClick={() => handleViewFile(f)}
                      style={{
                        fontSize: 13,
                        padding: "6px 10px",
                        background: selectedFile?.filename === f.filename ? "#f0f7ff" : "transparent",
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between"
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</span>
                      <span style={{ color: f.status === "added" ? "#2da44e" : f.status === "removed" ? "#cf222e" : "#8c959f", fontWeight: 600 }}>
                        {f.status === "added" ? "+" : f.status === "removed" ? "-" : "M"}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card style={{ minWidth: 0, overflow: "hidden" }}>
                <h3 style={{ marginTop: 0, fontSize: 16, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {selectedFile ? selectedFile.filename : "Select a file to view content"}
                </h3>
                {loadingContent ? (
                  <div>Loading content...</div>
                ) : fileContent ? (
                  <pre style={{
                    background: "#f6f8fa",
                    padding: 16,
                    borderRadius: 8,
                    overflowX: "auto",
                    fontSize: 12,
                    fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
                    border: "1px solid #d0d7de",
                    margin: 0,
                    maxHeight: 600
                  }}>
                    <code>{fileContent.content}</code>
                  </pre>
                ) : (
                  <div style={{ color: "#666", textAlign: "center", padding: "40px 0" }}>
                    Select a file from the list to see its current content in the branch.
                  </div>
                )}
              </Card>
            </div>
          </>
        ) : (
          <Card style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>
            <div>Select a pull request to see details.</div>
          </Card>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d0d7de",
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.2s",
};

const buttonStyle: React.CSSProperties = {
  background: "#2da44e",
  color: "#fff",
  border: "none",
  padding: "12px",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background-color 0.2s",
};

const linkButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "1px solid #d0d7de",
  background: "#f6f8fa",
  color: "#24292f",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600
};
