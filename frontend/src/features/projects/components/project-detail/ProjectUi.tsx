export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
      {children}
    </div>
  );
}

export function MiniCard(props: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
      <div style={{ color: "#777" }}>{props.title}</div>
      <div style={{ fontWeight: 800, marginTop: 4 }}>{props.value}</div>
    </div>
  );
}

export function Stat(props: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
      <div style={{ color: "#777" }}>{props.label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{props.value}</div>
    </div>
  );
}

export function MiniStat(props: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
      <div style={{ color: "#777" }}>{props.label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{props.value}</div>
    </div>
  );
}

export function SectionTable(props: {
  title: string;
  emptyText: string;
  table: React.ReactNode | null;
}) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{props.title}</div>
      {!props.table ? <div style={{ color: "#888" }}>{props.emptyText}</div> : props.table}
    </div>
  );
}

export function CompareCard(props: { title: string; subtitle: string; body: string }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, background: "#fff" }}>
      <div style={{ fontWeight: 900, fontSize: 16 }}>{props.title}</div>
      <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{props.subtitle}</div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45 }}>{props.body}</div>
    </div>
  );
}

export function ScoreBadge({ value }: { value: number }) {
  const pct = (Number(value) || 0) * 100;
  const bg = pct >= 80 ? "#eef5ff" : pct >= 70 ? "#fff5e6" : "#ffecec";
  const fg = pct >= 80 ? "#094780" : pct >= 70 ? "#8a5a00" : "#a00000";

  return (
    <span
      style={{
        background: bg,
        color: fg,
        border: "1px solid #eee",
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      {`${Math.round((Number(value) || 0) * 100)}%`}
    </span>
  );
}