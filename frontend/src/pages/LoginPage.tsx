import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth";
import ErrorModal from "../components/ErrorModal";
import { buttonBase, cardBase, inputBase, ui } from "../theme/ui";

type ErrorState = {
  open: boolean;
  title: string;
  message: string;
  cause: string;
  details: string;
};

const EMPTY_ERROR: ErrorState = {
  open: false,
  title: "",
  message: "",
  cause: "",
  details: "",
};

function buildLoginError(error: unknown): ErrorState {
  const raw =
    error instanceof Error ? error.message || "Unknown login error" : String(error || "Unknown login error");

  const text = raw.toLowerCase();

  let cause =
    "The login request failed because the backend rejected the credentials or the request could not be completed.";

  if (text.includes("401") || text.includes("unauthorized")) {
    cause =
      "The username/email or password is incorrect, or the backend rejected the login credentials.";
  } else if (text.includes("403") || text.includes("forbidden")) {
    cause =
      "Your account may not be allowed to access the system, or your user is disabled or restricted.";
  } else if (text.includes("network") || text.includes("failed to fetch")) {
    cause =
      "The frontend could not reach the backend. Django may not be running, the API URL may be wrong, or there may be a connection problem.";
  } else if (text.includes("csrf")) {
    cause =
      "The login request may have failed because of a CSRF or session issue between the frontend and backend.";
  } else if (text.includes("500") || text.includes("internal server error")) {
    cause =
      "The backend failed while processing the login request. This is usually caused by a server-side exception or auth configuration problem.";
  } else if (text.includes("inactive") || text.includes("disabled")) {
    cause =
      "Your account may exist, but it is currently disabled or inactive in the system.";
  }

  return {
    open: true,
    title: "Login failed",
    message: 'The action "sign in" could not be completed.',
    cause,
    details: raw,
  };
}

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorModal, setErrorModal] = useState<ErrorState>(EMPTY_ERROR);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await login(username.trim(), password);
      nav("/");
    } catch (e: unknown) {
      setErrorModal(buildLoginError(e));
    }
  }

  return (
    <>
      <div
        style={{
          height: "100vh",
          overflow: "hidden",
          boxSizing: "border-box",
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
              padding: "40px 32px 30px",
              background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center"
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
                fontSize: 24,
                marginBottom: 16,
                boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
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
                  marginTop: 12,
                  padding: "12px",
                  border: "1px solid transparent",
                  background: ui.colors.primary,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "16px",
                  borderRadius: "8px",
                  boxShadow: "0 12px 26px rgba(15,61,145,0.18)",
                  transition: "all 0.2s ease-in-out",
                }}
              >
                Sign in
              </button>

              <div style={{ color: ui.colors.textMuted, fontSize: 13, lineHeight: 1.6, textAlign: "center", marginTop: 8 }}>
                Accounts are created by the Admin.
              </div>
            </form>
          </div>
        </div>
      </div>

      <ErrorModal
        open={errorModal.open}
        title={errorModal.title}
        message={errorModal.message}
        cause={errorModal.cause}
        details={errorModal.details}
        onClose={() => setErrorModal(EMPTY_ERROR)}
      />
    </>
  );
}