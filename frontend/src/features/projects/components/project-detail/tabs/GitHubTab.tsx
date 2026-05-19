import React, { useState, useEffect } from "react";
import { Card } from "../ProjectUi";
import {
  connectGitHub,
  fetchGitHubRepo,
  fetchGitHubBranches,
  createGitHubBranch,
} from "../../../../../api/github";
import type { GitHubRepoApi, GitHubBranchApi } from "../../../../../api/github";

type Props = { projectId: number; isAdmin?: boolean };

export default function GitHubTab({ projectId }: Props) {
  const [repo, setRepo] = useState<GitHubRepoApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [branches, setBranches] = useState<GitHubBranchApi[]>([]);
  const [newBranchName, setNewBranchName] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);

  useEffect(() => { loadRepo(); }, [projectId]);

  const loadRepo = async () => {
    setLoading(true);
    try {
      const data = await fetchGitHubRepo(projectId);
      setRepo(data);
      const branchesData = await fetchGitHubBranches(projectId);
      setBranches(branchesData);
    } catch {
      setRepo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setError(null);
    try {
      const data = await connectGitHub(projectId, { owner, repo_name: repoName, access_token: token });
      setRepo(data);
      const branchesData = await fetchGitHubBranches(projectId);
      setBranches(branchesData);
    } catch (err: any) {
      setError(err.message || "Failed to connect to GitHub");
    } finally {
      setConnecting(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const branchName = newBranchName.trim();
    if (!branchName || branches.length === 0) return;
    const baseBranch = branches.find(b => b.name === repo?.default_branch) || branches[0];
    setCreatingBranch(true);
    try {
      await createGitHubBranch(projectId, branchName, baseBranch.commit.sha);
      setNewBranchName("");
      const branchesData = await fetchGitHubBranches(projectId);
      setBranches(branchesData);
      alert(`Branch '${branchName}' created successfully!`);
    } catch (err: any) {
      alert(err.message || "Failed to create branch");
    } finally {
      setCreatingBranch(false);
    }
  };

  if (loading) return <div>Loading GitHub integration...</div>;

  if (!repo) {
    return (
      <Card>
        <h3 style={{ marginTop: 0 }}>Connect GitHub Repository</h3>
        <p style={{ color: "#666" }}>Link this project to a GitHub repository to track pull requests and developer work in the Dev Submissions tab.</p>
        <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Repository Owner</label>
            <input type="text" placeholder="e.g. facebook" value={owner} onChange={e => setOwner(e.target.value)} required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Repository Name</label>
            <input type="text" placeholder="e.g. react" value={repoName} onChange={e => setRepoName(e.target.value)} required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Personal Access Token</label>
            <input type="password" placeholder="ghp_xxxxxxxxxxxx" value={token} onChange={e => setToken(e.target.value)} required style={inputStyle} />
            <small style={{ color: "#888" }}>Token is stored securely and never exposed to the frontend.</small>
          </div>
          {error && <div style={{ color: "#ff4d4f", fontSize: 14 }}>{error}</div>}
          <button type="submit" disabled={connecting} style={buttonStyle}>
            {connecting ? "Connecting..." : "Connect Repository"}
          </button>
        </form>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 500 }}>
      <Card>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Connected Repository</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href={repo.github_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "#0969da", textDecoration: "none" }}>
            {repo.owner}/{repo.repo_name}
          </a>
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
          Default Branch: <strong>{repo.default_branch}</strong>
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: "#888" }}>
          Pull requests and developer work are shown in the <strong>Dev Submissions</strong> tab.
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
          <button type="submit" disabled={creatingBranch || !newBranchName} style={{ ...buttonStyle, padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}>
            {creatingBranch ? "..." : "Create"}
          </button>
        </form>
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {branches.map(b => (
            <div key={b.name} style={{ fontSize: 13, padding: "4px 8px", background: "#f6f8fa", borderRadius: 4, border: "1px solid #d0d7de" }}>
              {b.name === repo.default_branch ? <strong>{b.name} (default)</strong> : b.name}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid #d0d7de", fontSize: 14, outline: "none",
};

const buttonStyle: React.CSSProperties = {
  background: "#2da44e", color: "#fff", border: "none",
  padding: "12px", borderRadius: 8, fontSize: 14,
  fontWeight: 600, cursor: "pointer",
};