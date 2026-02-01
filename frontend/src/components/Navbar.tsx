import { NavLink } from "react-router-dom";

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  textDecoration: "none",
  color: isActive ? "#094780" : "#333",
  fontWeight: isActive ? 700 : 500,
});

export default function Navbar() {
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

      <div style={{ display: "flex", gap: 14 }}>
        <NavLink to="/" end style={linkStyle}>
          Dashboard
        </NavLink>
        <NavLink to="/projects" style={linkStyle}>
          Projects
        </NavLink>
        <NavLink to="/reports" style={linkStyle}>
          Reports
        </NavLink>
        <NavLink to="/developers" style={linkStyle}>
          Developers
        </NavLink>
        <NavLink to="/export" style={linkStyle}>
          Export
        </NavLink>
      </div>
    </nav>
  );
}
