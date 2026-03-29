import React, { useState } from "react";

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
  const [correctnessScore, setCorrectnessScore] = useState(
    initialValues?.correctnessScore ?? 80
  );
  const [qualityScore, setQualityScore] = useState(
    initialValues?.qualityScore ?? 80
  );
  const [timelinessScore, setTimelinessScore] = useState(
    initialValues?.timelinessScore ?? 80
  );
  const [communicationScore, setCommunicationScore] = useState(
    initialValues?.communicationScore ?? 80
  );
  const [comments, setComments] = useState(initialValues?.comments ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const scores = [
      correctnessScore,
      qualityScore,
      timelinessScore,
      communicationScore,
    ];

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
    (
      correctnessScore +
      qualityScore +
      timelinessScore +
      communicationScore
    ) / 4;

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 10,
        background: "#fafafa",
      }}
    >
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <label>
          <div>Correctness</div>
          <input
            type="number"
            min={0}
            max={100}
            value={correctnessScore}
            onChange={(e) => setCorrectnessScore(Number(e.target.value))}
            style={{ width: "90%", padding: 4 }}
          />
        </label>

        <label>
          <div>Quality</div>
          <input
            type="number"
            min={0}
            max={100}
            value={qualityScore}
            onChange={(e) => setQualityScore(Number(e.target.value))}
            style={{ width: "90%", padding: 4 }}
          />
        </label>

        <label>
          <div>Timeliness</div>
          <input
            type="number"
            min={0}
            max={100}
            value={timelinessScore}
            onChange={(e) => setTimelinessScore(Number(e.target.value))}
            style={{ width: "90%", padding: 4 }}
          />
        </label>

        <label>
          <div>Communication</div>
          <input
            type="number"
            min={0}
            max={100}
            value={communicationScore}
            onChange={(e) => setCommunicationScore(Number(e.target.value))}
            style={{ width: "90%", padding: 4 }}
          />
        </label>
      </div>

      <label style={{ display: "block", marginTop: 10 }}>
        <div>Comments</div>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          style={{ width: "95%", padding: 8 }}
        />
      </label>

      <div style={{ marginTop: 10, color: "#555" }}>
        Predicted Final Score: <strong>{avg.toFixed(2)}</strong>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Evaluation"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}