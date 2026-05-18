export const ui = {
    colors: {
      bg: "#f4f7fb",
      bgElevated: "#ffffff",
      bgSoft: "#f8fbff",
      bgDark: "#0f172a",
  
      text: "#0f172a",
      textSoft: "#475569",
      textMuted: "#64748b",
  
      border: "#e2e8f0",
      borderStrong: "#cbd5e1",
  
      primary: "#0f3d91",
      primaryHover: "#0c3277",
      primarySoft: "#edf4ff",
  
      accent: "#06b6d4",
      accentSoft: "#ecfeff",
  
      success: "#15803d",
      successSoft: "#f0fdf4",
  
      warning: "#b45309",
      warningSoft: "#fff7ed",
  
      danger: "#b91c1c",
      dangerSoft: "#fef2f2",
  
      violet: "#6d28d9",
      violetSoft: "#f5f3ff",
  
      overlay: "rgba(15, 23, 42, 0.52)",
    },
  
    radius: {
      sm: 10,
      md: 14,
      lg: 18,
      xl: 22,
      pill: 999,
    },
  
    shadow: {
      sm: "0 4px 14px rgba(15, 23, 42, 0.06)",
      md: "0 10px 30px rgba(15, 23, 42, 0.08)",
      lg: "0 20px 60px rgba(15, 23, 42, 0.14)",
    },
  
    transition: "all 160ms ease",
  };
  
  export const buttonBase: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: ui.radius.md,
    fontWeight: 700,
    cursor: "pointer",
    transition: ui.transition,
  };
  
  export const cardBase: React.CSSProperties = {
    background: ui.colors.bgElevated,
    border: `1px solid ${ui.colors.border}`,
    borderRadius: ui.radius.lg,
    boxShadow: ui.shadow.sm,
  };
  
  export const inputBase: React.CSSProperties = {
    padding: "11px 13px",
    borderRadius: ui.radius.md,
    border: `1px solid ${ui.colors.borderStrong}`,
    outline: "none",
    background: "#fff",
    color: ui.colors.text,
    boxSizing: "border-box",
  };
  
  export const sectionTitle: React.CSSProperties = {
    marginTop: 0,
    marginBottom: 6,
    fontSize: 20,
    fontWeight: 800,
    color: ui.colors.text,
  };