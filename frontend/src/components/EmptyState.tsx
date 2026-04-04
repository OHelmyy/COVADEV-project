import { ui } from "../theme/ui";

type Props = {
  title: string;
  description?: string;
};

export default function EmptyState({ title, description }: Props) {
  return (
    <div
      style={{
        border: `1px dashed ${ui.colors.borderStrong}`,
        borderRadius: ui.radius.lg,
        padding: 20,
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
        color: ui.colors.textSoft,
      }}
    >
      <div style={{ fontWeight: 900, color: ui.colors.text, fontSize: 16 }}>
        {title}
      </div>
      {description ? (
        <div style={{ marginTop: 8, fontSize: 14, color: ui.colors.textMuted, lineHeight: 1.6 }}>
          {description}
        </div>
      ) : null}
    </div>
  );
}