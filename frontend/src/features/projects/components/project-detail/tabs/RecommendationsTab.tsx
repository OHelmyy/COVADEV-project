import StatusMessage from "../../../../../components/StatusMessage";
import { Card } from "../ProjectUi";
import type { LoadState } from "../../../types/projectDetail";

type Props = {
  recState: LoadState;
  recError: string;
  recommendations: string[];
  recUpdatedAt: string | null;
  hasSummary: boolean;
  canGenerate: boolean;
  onRefresh: () => void;
  onGenerate: () => void;
  onRetry: () => void;
};

export default function RecommendationsTab({
  recState,
  recError,
  recommendations,
  recUpdatedAt,
  hasSummary,
  canGenerate,
  onRefresh,
  onGenerate,
  onRetry,
}: Props) {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>Recommended Methods</h3>
          <div style={{ color: "#666" }}>
            Generated from the stored BPMN summary (best practices).
          </div>
          {recUpdatedAt ? (
            <div style={{ color: "#888", fontSize: 13, marginTop: 6 }}>
              Last updated: {recUpdatedAt}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onRefresh}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
          >
            Refresh
          </button>

          {canGenerate ? (
            <button
              onClick={onGenerate}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #094780",
                background: "#f3f7ff",
                color: "#094780",
                fontWeight: 800,
              }}
            >
              Generate
            </button>
          ) : null}
        </div>
      </div>

      {!hasSummary ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ffe3b3",
            background: "#fff8e8",
          }}
        >
          <div style={{ fontWeight: 800, color: "#8a5a00" }}>
            No BPMN summary found
          </div>
          <div style={{ color: "#8a5a00", marginTop: 6, fontSize: 13 }}>
            Upload a BPMN (Evaluator) and make sure the summary is
            generated/stored, then try again.
          </div>
        </div>
      ) : recState === "loading" || recState === "idle" ? (
        <StatusMessage title="Loading recommendations..." />
      ) : recState === "error" ? (
        <StatusMessage
          title="Failed to load recommendations"
          message={recError}
          onRetry={onRetry}
        />
      ) : recommendations.length === 0 ? (
        <div style={{ color: "#888", marginTop: 12 }}>
          No recommendations yet.{" "}
          {canGenerate ? (
            <>
              Click <b>Generate</b> to create them.
            </>
          ) : null}
        </div>
      ) : (
        <ul style={{ marginTop: 12, paddingLeft: 18 }}>
          {recommendations.map((item, index) => (
            <li key={index} style={{ marginBottom: 8, lineHeight: 1.55 }}>
              {String(item).replace(/^- /, "")}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
