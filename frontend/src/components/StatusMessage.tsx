import { buttonBase, cardBase, ui } from "../theme/ui";

type Props = {
  title: string;
  message?: string;
  onRetry?: () => void;
};

export default function StatusMessage({ title, message, onRetry }: Props) {
  return (
    <div
      style={{
        ...cardBase,
        padding: 18,
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 8, color: ui.colors.text, fontSize: 16 }}>
        {title}
      </div>
      {message ? (
        <div style={{ color: ui.colors.textMuted, fontSize: 14, lineHeight: 1.6 }}>
          {message}
        </div>
      ) : null}
      {onRetry ? (
        <button
          onClick={onRetry}
          style={{
            ...buttonBase,
            marginTop: 14,
            border: `1px solid ${ui.colors.borderStrong}`,
            background: "#fff",
            color: ui.colors.text,
          }}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}