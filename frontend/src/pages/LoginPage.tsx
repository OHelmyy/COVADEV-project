// src/pages/LoginPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    try {
      await login(username.trim(), password);
      // ✅ don't read user.role here; auth state updates async
      nav("/");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: "0 16px" }}>
      <h2 style={{ marginBottom: 12 }}>Login</h2>

      {err && (
        <div
          style={{
            background: "#fff3f3",
            border: "1px solid #ffd0d0",
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label>
          Email / Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ddd",
              marginTop: 6,
            }}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ddd",
              marginTop: 6,
            }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #094780",
            background: "#094780",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          Sign in
        </button>

        <div style={{ color: "#666", fontSize: 13 }}>
          Accounts are created by the Admin.
        </div>
      </form>
    </div>
  );
}