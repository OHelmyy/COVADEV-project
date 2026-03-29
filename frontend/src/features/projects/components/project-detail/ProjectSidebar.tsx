import type { ProjectTabItem, TabKey } from "../../types/projectDetail";

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
        border: "1px solid #eee",
        borderRadius: 12,
        background: "#fff",
        padding: 10,
      }}
    >
      <div
        style={{
          fontWeight: 900,
          padding: "10px 10px",
          borderBottom: "1px solid #f3f3f3",
        }}
      >
        Project
      </div>

      <div style={{ padding: "10px 10px", color: "#666" }}>
        <div style={{ fontWeight: 800 }}>{projectName}</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
          Role: <b>{role}</b>
          {isAdmin ? <span style={{ marginLeft: 6 }}>(read-only)</span> : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 6, padding: 10 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChangeTab(tab.key)}
            style={{
              textAlign: "left",
              padding: "10px 10px",
              borderRadius: 10,
              border: "1px solid",
              borderColor: activeTab === tab.key ? "#094780" : "#eee",
              background: activeTab === tab.key ? "#f3f7ff" : "#fff",
              color: activeTab === tab.key ? "#094780" : "#333",
              fontWeight: activeTab === tab.key ? 800 : 600,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </aside>
  );
}