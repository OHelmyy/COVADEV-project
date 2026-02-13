import { useEffect, useState } from "react";
import { fetchAdminDashboard, type AdminDashboardStats } from "../api/adminDashboard";

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

  if (loading) return <div>Loading...</div>;
  if (err) return <div style={{ color: "red" }}>{err}</div>;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Admin Dashboard</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 16 }}>
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
        padding: 20,
        borderRadius: 12,
        border: "1px solid #eee",
        background: "#fff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#094780" }}>
        {value ?? 0}
      </div>
    </div>
  );
}