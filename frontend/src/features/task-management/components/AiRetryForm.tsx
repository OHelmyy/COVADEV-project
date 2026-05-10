import { useState } from "react";
import { ui, buttonBase, inputBase } from "../../../theme/ui";

type Props = {
  retryCount: number;
  maxRetries: number;
  saving: boolean;
  onSubmit: (feedback: string) => Promise<void> | void;
  onCancel: () => void;
};

export default function AiRetryForm({
  retryCount,
  maxRetries,
  saving,
  onSubmit,
  onCancel,
}: Props) {
  const [feedback, setFeedback] = useState("");
  const remaining = Math.max(0, maxRetries - retryCount);

  async function handleSubmit() {
    const trimmed = feedback.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontWeight: 800 }}>Send back to AI with feedback</div>
      <div style={{ fontSize: 12, color: ui.colors.textMuted }}>
        Retries used: {retryCount} / {maxRetries} &middot; {remaining} remaining
      </div>

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Tell the AI exactly what to change. Be specific about bugs, missing functionality, or style preferences."
        rows={5}
        style={{
          ...inputBase,
          padding: 10,
          minHeight: 100,
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !feedback.trim()}
          style={{
            ...buttonBase,
            padding: "8px 12px",
            background: ui.colors.primary,
            color: "#fff",
            border: "none",
            opacity: saving || !feedback.trim() ? 0.6 : 1,
          }}
        >
          {saving ? "Sending..." : "Send Back to AI"}
        </button>

        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            ...buttonBase,
            padding: "8px 12px",
            background: "#fff",
            border: `1px solid ${ui.colors.borderStrong}`,
            color: ui.colors.text,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}