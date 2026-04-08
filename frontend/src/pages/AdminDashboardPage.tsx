import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminDashboard, type AdminDashboardStats } from "../api/adminDashboard";
import { buttonBase, cardBase, ui } from "../theme/ui";

type LoadState = "loading" | "success" | "error";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setState("loading");
        setErr("");
        const res = await fetchAdminDashboard();
        setStats(res.stats);
        setState("success");
      } catch (e: any) {
        setErr(e?.message || "Failed to load admin dashboard");
        setState("error");
      }
    })();
  }, []);

  const safeStats = stats ?? {
    totalUsers: 0,
    totalProjects: 0,
    admins: 0,
    evaluators: 0,
    developers: 0,
  };

  const roleDistribution = useMemo(() => {
    const total = Math.max(safeStats.totalUsers, 1);

    return [
      {
        label: "Admins",
        value: safeStats.admins,
        percent: (safeStats.admins / total) * 100,
        color: ui.colors.primary,
        bg: ui.colors.primarySoft,
      },
      {
        label: "Evaluators",
        value: safeStats.evaluators,
        percent: (safeStats.evaluators / total) * 100,
        color: ui.colors.violet,
        bg: ui.colors.violetSoft,
      },
      {
        label: "Developers",
        value: safeStats.developers,
        percent: (safeStats.developers / total) * 100,
        color: ui.colors.accent,
        bg: ui.colors.accentSoft,
      },
    ];
  }, [safeStats]);

  const adminCoverage =
    safeStats.totalUsers > 0
      ? Math.round((safeStats.admins / safeStats.totalUsers) * 100)
      : 0;

  const evaluatorCoverage =
    safeStats.totalUsers > 0
      ? Math.round((safeStats.evaluators / safeStats.totalUsers) * 100)
      : 0;

  const developerCoverage =
    safeStats.totalUsers > 0
      ? Math.round((safeStats.developers / safeStats.totalUsers) * 100)
      : 0;

  if (state === "loading") {
    return (
      <div style={{ ...cardBase, padding: 18 }}>
        <div style={{ fontWeight: 900, color: ui.colors.text }}>
          Loading admin dashboard...
        </div>
      </div>
    );
  }

  if (state === "error") {
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
      <section
        style={{
          ...cardBase,
          padding: 22,
          background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
          color: "#fff",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -50,
            top: -50,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 80,
            bottom: -40,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.18)",
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 14,
            }}
          >
            ADMIN CONTROL CENTER
          </div>

          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>
            COVADEV Admin Dashboard
          </h1>

          <p
            style={{
              marginTop: 10,
              marginBottom: 0,
              maxWidth: 760,
              opacity: 0.96,
              lineHeight: 1.7,
            }}
          >
            Monitor platform growth, role distribution, and overall workspace setup
            from one central view.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 18,
            }}
          >
            <Link to="/users" style={{ textDecoration: "none" }}>
              <button
                style={{
                  ...buttonBase,
                  background: "#fff",
                  color: ui.colors.primary,
                  border: "1px solid rgba(255,255,255,0.2)",
                  fontWeight: 900,
                }}
              >
                Manage Users
              </button>
            </Link>

            <Link to="/projects" style={{ textDecoration: "none" }}>
              <button
                style={{
                  ...buttonBase,
                  background: "rgba(255,255,255,0.10)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontWeight: 800,
                }}
              >
                View Projects
              </button>
            </Link>

            <Link to="/projects/create" style={{ textDecoration: "none" }}>
              <button
                style={{
                  ...buttonBase,
                  background: "rgba(255,255,255,0.10)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontWeight: 800,
                }}
              >
                Create Project
              </button>
            </Link>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <MetricCard
          title="Total Users"
          value={safeStats.totalUsers}
          hint="All platform accounts"
          tone="primary"
        />
        <MetricCard
          title="Total Projects"
          value={safeStats.totalProjects}
          hint="All workspaces in the system"
          tone="accent"
        />
        <MetricCard
          title="Admins"
          value={safeStats.admins}
          hint={`${adminCoverage}% of users`}
          tone="primary"
        />
        <MetricCard
          title="Evaluators"
          value={safeStats.evaluators}
          hint={`${evaluatorCoverage}% of users`}
          tone="violet"
        />
        <MetricCard
          title="Developers"
          value={safeStats.developers}
          hint={`${developerCoverage}% of users`}
          tone="accent"
        />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div style={{ ...cardBase, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Role Distribution</h2>
              <div style={{ color: ui.colors.textMuted, fontSize: 14 }}>
                Current user composition across the platform.
              </div>
            </div>

            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: ui.colors.bgSoft,
                border: `1px solid ${ui.colors.border}`,
                color: ui.colors.textSoft,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Total Users: {safeStats.totalUsers}
            </div>
          </div>

          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            {roleDistribution.map((item) => (
              <div key={item.label}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        background: item.color,
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontWeight: 800, color: ui.colors.text }}>
                      {item.label}
                    </span>
                  </div>

                  <div style={{ color: ui.colors.textSoft, fontSize: 13, fontWeight: 700 }}>
                    {item.value} • {Math.round(item.percent)}%
                  </div>
                </div>

                <div
                  style={{
                    height: 14,
                    background: ui.colors.bgSoft,
                    borderRadius: 999,
                    overflow: "hidden",
                    border: `1px solid ${ui.colors.border}`,
                  }}
                >
                  <div
                    style={{
                      width: `${item.percent}%`,
                      height: "100%",
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ ...cardBase, padding: 18 }}>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Platform Breakdown</h2>
            <div style={{ color: ui.colors.textMuted, fontSize: 14, marginBottom: 14 }}>
              Key ratios that describe how the system is structured.
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <InsightRow
                label="Users per Project"
                value={
                  safeStats.totalProjects > 0
                    ? (safeStats.totalUsers / safeStats.totalProjects).toFixed(2)
                    : "0"
                }
              />

              <InsightRow
                label="Projects per Evaluator"
                value={
                  safeStats.evaluators > 0
                    ? (safeStats.totalProjects / safeStats.evaluators).toFixed(2)
                    : "0"
                }
              />

              <InsightRow
                label="Developers per Project"
                value={
                  safeStats.totalProjects > 0
                    ? (safeStats.developers / safeStats.totalProjects).toFixed(2)
                    : "0"
                }
              />
            </div>
          </div>

          
        </div>
      </section>

      <section style={{ ...cardBase, padding: 18 }}>
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>Quick Actions</h2>
        <div style={{ color: ui.colors.textMuted, fontSize: 14, marginBottom: 14 }}>
          Jump directly to common admin workflows.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <QuickAction
            to="/users"
            title="Manage Users"
            description="Create, activate, disable, and organize platform accounts."
          />
          <QuickAction
            to="/projects"
            title="Open Projects"
            description="Review all project workspaces and their current setup."
          />
          <QuickAction
            to="/projects/create"
            title="Create New Project"
            description="Start a new project workspace and assign its members."
          />
          <QuickAction
            to="/developer-performance"
            title="Developer Performance"
            description="Check task progress and evaluation scores across developers."
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value?: number | string;
  hint?: string;
  tone: "primary" | "accent" | "violet";
}) {
  const toneMap = {
    primary: {
      color: ui.colors.primary,
      bg: ui.colors.primarySoft,
    },
    accent: {
      color: ui.colors.accent,
      bg: ui.colors.accentSoft,
    },
    violet: {
      color: ui.colors.violet,
      bg: ui.colors.violetSoft,
    },
  }[tone];

  return (
    <div
      style={{
        ...cardBase,
        padding: 18,
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "6px 10px",
          borderRadius: 999,
          background: toneMap.bg,
          color: toneMap.color,
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 34,
          fontWeight: 900,
          color: ui.colors.text,
          lineHeight: 1,
        }}
      >
        {value ?? 0}
      </div>

      {hint ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            color: ui.colors.textMuted,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: 14,
        background: ui.colors.bgSoft,
        border: `1px solid ${ui.colors.border}`,
        gap: 12,
      }}
    >
      <div style={{ color: ui.colors.textSoft, fontWeight: 700 }}>{label}</div>
      <div style={{ color: ui.colors.text, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function QuickAction({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} style={{ textDecoration: "none" }}>
      <div
        style={{
          padding: 14,
          borderRadius: 16,
          border: `1px solid ${ui.colors.border}`,
          background: "#fff",
          transition: ui.transition,
          boxShadow: ui.shadow.sm,
        }}
      >
        <div style={{ fontWeight: 900, color: ui.colors.text }}>{title}</div>
        <div
          style={{
            marginTop: 6,
            color: ui.colors.textMuted,
            lineHeight: 1.6,
            fontSize: 14,
          }}
        >
          {description}
        </div>
      </div>
    </Link>
  );
}