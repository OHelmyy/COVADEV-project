import { cardBase, ui } from "../../../../theme/ui";

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...cardBase,
        padding: 18,
      }}
    >
      {children}
    </div>
  );
}

export function MiniCard(props: { title: string; value: string }) {
  return (
    <div
      style={{
        border: `1px solid ${ui.colors.border}`,
        borderRadius: ui.radius.lg,
        padding: 14,
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
      }}
    >
      <div style={{ color: ui.colors.textMuted, fontSize: 13, fontWeight: 700 }}>
        {props.title}
      </div>
      <div style={{ fontWeight: 800, marginTop: 6, color: ui.colors.text }}>
        {props.value}
      </div>
    </div>
  );
}

export function Stat(props: { label: string; value: number }) {
  return (
    <div
      style={{
        border: `1px solid ${ui.colors.border}`,
        borderRadius: ui.radius.lg,
        padding: 14,
        background: "#fff",
      }}
    >
      <div style={{ color: ui.colors.textMuted, fontSize: 13, fontWeight: 700 }}>
        {props.label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: ui.colors.text, marginTop: 6 }}>
        {props.value}
      </div>
    </div>
  );
}

export function MiniStat(props: { label: string; value: string }) {
  return (
    <div
      style={{
        border: `1px solid ${ui.colors.border}`,
        borderRadius: ui.radius.lg,
        padding: 14,
        background: ui.colors.bgSoft,
      }}
    >
      <div style={{ color: ui.colors.textMuted, fontSize: 13, fontWeight: 700 }}>
        {props.label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: ui.colors.text, marginTop: 6 }}>
        {props.value}
      </div>
    </div>
  );
}

export function SectionTable(props: {
  title: React.ReactNode;
  emptyText: string;
  table: React.ReactNode | null;
}) {
  return (
    <div
      style={{
        border: `1px solid ${ui.colors.border}`,
        borderRadius: ui.radius.lg,
        padding: 14,
        marginTop: 14,
        background: "#fff",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          marginBottom: 10,
          color: ui.colors.text,
          fontSize: 16,
        }}
      >
        {props.title}
      </div>
      {!props.table ? (
        <div style={{ color: ui.colors.textMuted }}>{props.emptyText}</div>
      ) : (
        <div style={{ overflowX: "auto", width: "100%" }}>
          {props.table}
        </div>
      )}
    </div>
  );
}

export function CompareCard(props: { title: string; subtitle: string; body: string }) {
  return (
    <div
      style={{
        border: `1px solid ${ui.colors.border}`,
        borderRadius: ui.radius.lg,
        padding: 14,
        background: "#fff",
        boxShadow: ui.shadow.sm,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16, color: ui.colors.text, wordBreak: "break-word" }}>{props.title}</div>
      <div style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 4, wordBreak: "break-all" }}>
        {props.subtitle}
      </div>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: ui.colors.textSoft, wordBreak: "break-word" }}>
        {props.body}
      </div>
    </div>
  );
}

export function ScoreBadge({ value }: { value: number }) {
  const pct = (Number(value) || 0) * 100;
  const bg =
    pct >= 80 ? ui.colors.primarySoft : pct >= 70 ? ui.colors.warningSoft : ui.colors.dangerSoft;
  const fg =
    pct >= 80 ? ui.colors.primary : pct >= 70 ? ui.colors.warning : ui.colors.danger;

  return (
    <span
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${ui.colors.border}`,
        padding: "6px 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 12,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {`${Math.round((Number(value) || 0) * 100)}%`}
    </span>
  );
}

export function SubTabs(props: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 16, borderBottom: `1px solid ${ui.colors.border}`, marginBottom: 20 }}>
      {props.tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => props.onChange(tab.key)}
          style={{
            padding: "8px 4px",
            background: "none",
            border: "none",
            borderBottom: tab.key === props.active ? `3px solid ${ui.colors.primary}` : "3px solid transparent",
            color: tab.key === props.active ? ui.colors.primary : ui.colors.textSoft,
            fontWeight: tab.key === props.active ? 800 : 600,
            cursor: "pointer",
            fontSize: 15,
            transition: ui.transition
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}