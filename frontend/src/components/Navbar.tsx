// frontend/src/components/Navbar.tsx
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth";

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  textDecoration: "none",
  color: isActive ? "#094780" : "#333",
  fontWeight: isActive ? 700 : 500,
});

export default function Navbar() {
  const nav = useNavigate();
  const { user, logout } = useAuth();

  const role = String(user?.role || "").toUpperCase();
  const isAdmin = role === "ADMIN";
  const isEvaluator = role === "EVALUATOR";
  const isDeveloper = role === "DEVELOPER";

  async function onLogout() {
    try {
      await logout();
    } finally {
      nav("/login");
    }
  }

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 18px",
        borderBottom: "1px solid #eee",
        background: "#fff",
      }}
    >
      <NavLink to="/" style={{ textDecoration: "none", color: "#111", fontWeight: 800 }}>
        COVADEV
      </NavLink>

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {/* ADMIN */}
        {isAdmin ? (
          <>
            <NavLink to="/admin" end style={linkStyle}>
              Dashboard
            </NavLink>
            <NavLink to="/projects" end style={linkStyle}>
              Projects
            </NavLink>
            <NavLink to="/users" end style={linkStyle}>
              Users
            </NavLink>
          </>
        ) : null}

        {/* EVALUATOR */}
        {isEvaluator ? (
          <>
            <NavLink to="/projects" end style={linkStyle}>
              Projects
            </NavLink>
            {/* Project-level tabs should appear inside ProjectDetailPage navigation, not global navbar */}
          </>
        ) : null}

        {/* DEVELOPER */}
        {isDeveloper ? (
          <>
            <NavLink to="/projects" end style={linkStyle}>
              Projects
            </NavLink>
            {/* Developer insights can be global OR inside project; keep global if you want */}
            <NavLink to="/me" end style={linkStyle}>
              My Insights
            </NavLink>
          </>
        ) : null}

        {/* user label */}
        {user?.email ? (
          <span style={{ color: "#666", fontSize: 13 }}>
            {user.email} • <b>{role || "USER"}</b>
          </span>
        ) : null}

        <button
          onClick={onLogout}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ff6b6b",
            background: "#fff",
            color: "#ff3b3b",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}