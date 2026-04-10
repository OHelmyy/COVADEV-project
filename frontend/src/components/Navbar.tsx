import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth";
import { buttonBase, ui } from "../theme/ui";
import NotificationsBell from "./NotificationsBell";

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  textDecoration: "none",
  color: isActive ? ui.colors.primary : ui.colors.textSoft,
  fontWeight: isActive ? 800 : 600,
  padding: "8px 10px",
  borderRadius: 10,
  background: isActive ? ui.colors.primarySoft : "transparent",
  transition: ui.transition,
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
        padding: "14px 20px",
        borderBottom: `1px solid ${ui.colors.border}`,
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(10px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <NavLink to="/" style={{ textDecoration: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              boxShadow: "0 12px 24px rgba(15,61,145,0.22)",
            }}
          >
            C
          </div>
          <div>
            <div style={{ color: ui.colors.text, fontWeight: 900, fontSize: 16 }}>
              COVADEV
            </div>
            <div style={{ fontSize: 11, color: ui.colors.textMuted }}>
              BPMN • Code • AI Traceability
            </div>
          </div>
        </div>
      </NavLink>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {isAdmin ? (
          <>
            <NavLink to="/admin" end style={linkStyle}>
              Dashboard
            </NavLink>
            <NavLink to="/projects" end style={linkStyle}>
              Projects
            </NavLink>
            <NavLink to="/developer-performance" end style={linkStyle}>
              Developer Performance
            </NavLink>
            <NavLink to="/users" end style={linkStyle}>
              Users
            </NavLink>
          </>
        ) : null}

        {isEvaluator ? (
          <>
            <NavLink to="/projects" end style={linkStyle}>
              Projects
            </NavLink>
            <NavLink to="/developer-performance" end style={linkStyle}>
              Developer Performance
            </NavLink>
          </>
        ) : null}

        {isDeveloper ? (
          <>
            <NavLink to="/my-insights" end style={linkStyle}>
              My Insights
            </NavLink>
            <NavLink to="/projects" end style={linkStyle}>
              Projects
            </NavLink>
            <NavLink to="/myTasks" end style={linkStyle}>
              My Tasks
            </NavLink>
          </>
        ) : null}

        {isDeveloper ? <NotificationsBell /> : null}

        {user?.email ? (
          <span
            style={{
              color: ui.colors.textSoft,
              fontSize: 13,
              padding: "8px 12px",
              borderRadius: 999,
              background: ui.colors.bgSoft,
              border: `1px solid ${ui.colors.border}`,
              marginLeft: 6,
            }}
          >
            {user.email} • <b>{role || "USER"}</b>
          </span>
        ) : null}

        <button
          onClick={onLogout}
          style={{
            ...buttonBase,
            padding: "9px 12px",
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff",
            color: ui.colors.danger,
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}