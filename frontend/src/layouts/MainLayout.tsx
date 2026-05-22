import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../app/auth";
import { ui } from "../theme/ui";

export default function MainLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHelpPage = location.pathname === "/help";

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top right, rgba(6,182,212,0.06), transparent 20%), radial-gradient(circle at top left, rgba(109,40,217,0.05), transparent 18%), #f4f7fb",
      }}
    >
      <Navbar />
      <main style={{ maxWidth: 1220, margin: "28px auto", padding: "0 18px 32px" }}>
        <Outlet />
      </main>

      {/* Floating Help Button */}
      {user && !isHelpPage && (
        <button
          onClick={() => navigate("/help")}
          title="Help"
          style={{
            position: "fixed",
            bottom: 32,
            right: 32,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${ui.colors.primary} 0%, ${ui.colors.accent} 100%)`,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(15,61,145,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            transition: ui.transition,
            color: "#fff",
            fontSize: 22,
            fontWeight: 900,
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.1)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
        >
          ?
        </button>
      )}
    </div>
  );
}