import { cardBase, ui } from "../theme/ui";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div
      style={{
        ...cardBase,
        padding: 18,
        minWidth: 220,
        background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
      }}
    >
      <div style={{ fontSize: 13, color: ui.colors.textMuted, marginBottom: 10, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: ui.colors.text }}>{value}</div>
      {hint ? (
        <div style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 8, lineHeight: 1.5 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}