import { useEffect, useState } from "react";
import { fetchAdminDashboard, type AdminDashboardStats } from "../api/adminDashboard";
import { cardBase, ui } from "../theme/ui";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchAdminDashboard();
        setStats(res.stats);
      } catch (e: any) {
        setErr(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ ...cardBase, padding: 18 }}>
        <div style={{ fontWeight: 900, color: ui.colors.text }}>Loading admin dashboard...</div>
      </div>
    );
  }

  if (err) {
    return (
      <div
        style={{
          ...cardBase,
          padding: 18,
          background: ui.colors.dangerSoft,
          borderColor: "#fecaca",
          color: ui.colors.danger,
          fontWeight: 700,
        }}
      >
        {err}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          ...cardBase,
          padding: 20,
          background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
          color: "#fff",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 28 }}>Admin Dashboard</h2>
        <div style={{ marginTop: 8, opacity: 0.96, maxWidth: 760, lineHeight: 1.7 }}>
          High-level overview of users, roles, and project distribution across the COVADEV platform.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
          gap: 16,
        }}
      >
        <Card title="Total Users" value={stats?.totalUsers} />
        <Card title="Total Projects" value={stats?.totalProjects} />
        <Card title="Admins" value={stats?.admins} />
        <Card title="Evaluators" value={stats?.evaluators} />
        <Card title="Developers" value={stats?.developers} />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value?: number }) {
  return (
    <div
      style={{
        ...cardBase,
        padding: 20,
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
      }}
    >
      <div style={{ fontSize: 13, color: ui.colors.textMuted, marginBottom: 10, fontWeight: 700 }}>
        {title}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: ui.colors.primary }}>
        {value ?? 0}
      </div>
    </div>
  );
}