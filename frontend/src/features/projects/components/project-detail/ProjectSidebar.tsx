import type { ProjectTabItem, TabKey } from "../../types/projectDetail";
import { ui } from "../../../../theme/ui";

type Props = {
  projectName: string;
  role: string;
  isAdmin: boolean;
  tabs: ProjectTabItem[];
  activeTab: TabKey;
  onChangeTab: (tab: TabKey) => void;
};

export default function ProjectSidebar({
  projectName,
  role,
  isAdmin,
  tabs,
  activeTab,
  onChangeTab,
}: Props) {
  return (
    <aside
      style={{
        border: `1px solid ${ui.colors.border}`,
        borderRadius: ui.radius.xl,
        background: "#fff",
        padding: 12,
        boxShadow: ui.shadow.sm,
        position: "sticky",
        top: 88,
      }}
    >
      <div
        style={{
          fontWeight: 900,
          padding: "12px 12px",
          borderBottom: `1px solid ${ui.colors.border}`,
          color: ui.colors.text,
          fontSize: 15,
        }}
      >
        Project Workspace
      </div>

      <div
        style={{
          margin: 10,
          padding: 14,
          borderRadius: 16,
          background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
          color: "#fff",
          boxShadow: "0 16px 28px rgba(15,61,145,0.18)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>{projectName}</div>
        <div style={{ fontSize: 13, opacity: 0.95, marginTop: 8 }}>
          Role: <b>{role}</b> {isAdmin ? "• read-only" : ""}
        </div>
      </div>

      <div style={{ display: "grid", gap: 8, padding: 10 }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => onChangeTab(tab.key)}
              style={{
                textAlign: "left",
                padding: "12px 12px",
                borderRadius: 14,
                border: `1px solid ${active ? "#bfdbfe" : ui.colors.border}`,
                background: active ? ui.colors.primarySoft : "#fff",
                color: active ? ui.colors.primary : ui.colors.textSoft,
                fontWeight: active ? 800 : 700,
                cursor: "pointer",
                transition: ui.transition,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}