import React, { useState } from "react";
import { buttonBase, cardBase, inputBase, ui } from "../../../theme/ui";

type Props = {
  initialValues?: {
    correctnessScore?: number;
    qualityScore?: number;
    timelinessScore?: number;
    communicationScore?: number;
    comments?: string;
  } | null;
  onSubmit: (payload: {
    correctnessScore: number;
    qualityScore: number;
    timelinessScore: number;
    communicationScore: number;
    comments: string;
  }) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
};

export default function EvaluationForm({
  initialValues,
  onSubmit,
  onCancel,
  saving = false,
}: Props) {
  const [correctnessScore, setCorrectnessScore] = useState(initialValues?.correctnessScore ?? 80);
  const [qualityScore, setQualityScore] = useState(initialValues?.qualityScore ?? 80);
  const [timelinessScore, setTimelinessScore] = useState(initialValues?.timelinessScore ?? 80);
  const [communicationScore, setCommunicationScore] = useState(initialValues?.communicationScore ?? 80);
  const [comments, setComments] = useState(initialValues?.comments ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const scores = [correctnessScore, qualityScore, timelinessScore, communicationScore];
    const invalid = scores.some((s) => Number.isNaN(s) || s < 0 || s > 100);

    if (invalid) {
      alert("All scores must be between 0 and 100.");
      return;
    }

    await onSubmit({
      correctnessScore,
      qualityScore,
      timelinessScore,
      communicationScore,
      comments,
    });
  }

  const avg =
    (correctnessScore + qualityScore + timelinessScore + communicationScore) / 4;

  function scoreTone(score: number) {
    if (score >= 85) {
      return { bg: ui.colors.successSoft, color: ui.colors.success };
    }
    if (score >= 70) {
      return { bg: ui.colors.warningSoft, color: ui.colors.warning };
    }
    return { bg: ui.colors.dangerSoft, color: ui.colors.danger };
  }

  const avgTone = scoreTone(avg);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        ...cardBase,
        marginTop: 12,
        padding: 18,
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 17, color: ui.colors.text }}>
            Evaluation Form
          </div>
          <div style={{ color: ui.colors.textMuted, marginTop: 4, fontSize: 13 }}>
            Score the submitted task across key quality dimensions.
          </div>
        </div>

        <div
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            background: avgTone.bg,
            color: avgTone.color,
            border: `1px solid ${ui.colors.border}`,
            fontWeight: 900,
            fontSize: 13,
          }}
        >
          Predicted Final Score: {avg.toFixed(2)}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700, color: ui.colors.textSoft }}>Correctness</span>
          <input
            type="number"
            min={0}
            max={100}
            value={correctnessScore}
            onChange={(e) => setCorrectnessScore(Number(e.target.value))}
            style={{ ...inputBase, width: "100%" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700, color: ui.colors.textSoft }}>Quality</span>
          <input
            type="number"
            min={0}
            max={100}
            value={qualityScore}
            onChange={(e) => setQualityScore(Number(e.target.value))}
            style={{ ...inputBase, width: "100%" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700, color: ui.colors.textSoft }}>Timeliness</span>
          <input
            type="number"
            min={0}
            max={100}
            value={timelinessScore}
            onChange={(e) => setTimelinessScore(Number(e.target.value))}
            style={{ ...inputBase, width: "100%" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700, color: ui.colors.textSoft }}>Communication</span>
          <input
            type="number"
            min={0}
            max={100}
            value={communicationScore}
            onChange={(e) => setCommunicationScore(Number(e.target.value))}
            style={{ ...inputBase, width: "100%" }}
          />
        </label>
      </div>

      <label style={{ display: "block", marginTop: 14 }}>
        <div style={{ fontWeight: 700, color: ui.colors.textSoft, marginBottom: 6 }}>Comments</div>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={4}
          style={{
            ...inputBase,
            width: "100%",
            resize: "vertical",
            lineHeight: 1.6,
            fontFamily: "inherit",
          }}
        />
      </label>

      <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            ...buttonBase,
            border: `1px solid ${ui.colors.borderStrong}`,
            background: "#fff",
            color: ui.colors.text,
          }}
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving}
          style={{
            ...buttonBase,
            border: "1px solid transparent",
            background: ui.colors.primary,
            color: "#fff",
            boxShadow: "0 12px 24px rgba(15,61,145,0.18)",
          }}
        >
          {saving ? "Saving..." : "Save Evaluation"}
        </button>
      </div>
    </form>
  );
}