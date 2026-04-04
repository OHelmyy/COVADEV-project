import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth";
import { buttonBase, cardBase, inputBase, ui } from "../theme/ui";

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
      nav("/");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px 16px",
        background:
          "radial-gradient(circle at top left, rgba(109,40,217,0.08), transparent 20%), radial-gradient(circle at top right, rgba(6,182,212,0.08), transparent 24%), #f4f7fb",
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          ...cardBase,
          overflow: "hidden",
          boxShadow: ui.shadow.lg,
        }}
      >
        <div
          style={{
            padding: "24px 24px 18px",
            background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
            color: "#fff",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "rgba(255,255,255,0.14)",
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              fontSize: 22,
              marginBottom: 14,
            }}
          >
            C
          </div>
          <h2 style={{ margin: 0, fontSize: 28 }}>Welcome to COVADEV</h2>
          <div style={{ marginTop: 8, opacity: 0.96, lineHeight: 1.6 }}>
            Sign in to continue to your BPMN, code analysis, and traceability workspace.
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {err ? (
            <div
              style={{
                background: ui.colors.dangerSoft,
                border: "1px solid #fecaca",
                color: ui.colors.danger,
                padding: 12,
                borderRadius: 12,
                marginBottom: 14,
                fontWeight: 700,
              }}
            >
              {err}
            </div>
          ) : null}

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 700, color: ui.colors.textSoft }}>Email / Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ ...inputBase, width: "100%" }}
                placeholder="Enter your email or username"
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 700, color: ui.colors.textSoft }}>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputBase, width: "100%" }}
                placeholder="Enter your password"
              />
            </label>

            <button
              type="submit"
              style={{
                ...buttonBase,
                marginTop: 4,
                border: "1px solid transparent",
                background: ui.colors.primary,
                color: "#fff",
                fontWeight: 800,
                boxShadow: "0 12px 26px rgba(15,61,145,0.18)",
              }}
            >
              Sign in
            </button>

            <div style={{ color: ui.colors.textMuted, fontSize: 13, lineHeight: 1.6 }}>
              Accounts are created by the Admin.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}