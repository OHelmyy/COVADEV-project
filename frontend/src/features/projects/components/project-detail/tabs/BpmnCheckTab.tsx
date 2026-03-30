import { Card } from "../ProjectUi";
import { codeboxStyle, fmtDate } from "../../../utils/projectDetail";

type Props = {
  activeBpmn?: {
    originalName?: string | null;
    uploadedBy?: string | null;
    createdAt?: string | null;
  } | null;
  isWellFormed: boolean | null;
  precheckWarnings: string[];
  precheckErrors: string[];
  bpmnSummary: string;
};

export default function BpmnCheckTab({
  activeBpmn,
  isWellFormed,
  precheckWarnings,
  precheckErrors,
  bpmnSummary,
}: Props) {
  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>BPMN Check</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 10,
        }}
      >
        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
          <div style={{ color: "#777" }}>Active BPMN</div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>
            {activeBpmn?.originalName ?? (
              <span style={{ color: "#888" }}>None uploaded yet</span>
            )}
          </div>

          {activeBpmn?.uploadedBy ? (
            <div style={{ color: "#888", fontSize: 13, marginTop: 6 }}>
              Uploaded by {activeBpmn.uploadedBy}
              {activeBpmn.createdAt ? ` • ${fmtDate(activeBpmn.createdAt)}` : null}
            </div>
          ) : null}
        </div>
      </div>

      {activeBpmn ? (
        <div
          style={{
            border: "1px solid #f0f0f0",
            borderRadius: 12,
            padding: 12,
            marginTop: 12,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Pre-development</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginTop: 12,
            }}
          >
            <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#777" }}>BPMN Well-Formed Check</div>

              {isWellFormed === true ? (
                <div style={{ marginTop: 8, fontWeight: 900 }}>✅ Valid BPMN/XML</div>
              ) : isWellFormed === false ? (
                <div style={{ marginTop: 8, fontWeight: 900 }}>❌ Invalid BPMN/XML</div>
              ) : (
                <div style={{ marginTop: 8, color: "#888", fontWeight: 700 }}>
                  No check result returned yet.
                </div>
              )}

              {precheckWarnings.length > 0 ? (
                <>
                  <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "#777" }}>
                    Warnings
                  </div>
                  <pre style={codeboxStyle}>
                    {precheckWarnings.map((warning) => `- ${warning}`).join("\n")}
                  </pre>
                </>
              ) : null}

              {precheckErrors.length > 0 ? (
                <>
                  <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "#777" }}>
                    Errors
                  </div>
                  <pre style={codeboxStyle}>
                    {precheckErrors.map((error) => `- ${error}`).join("\n")}
                  </pre>
                </>
              ) : null}

              {precheckWarnings.length === 0 && precheckErrors.length === 0 ? (
                <div style={{ color: "#888", marginTop: 10, fontSize: 13 }}>
                  No warnings/errors returned yet.
                </div>
              ) : null}
            </div>

            <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#777" }}>BPMN Summary (T5)</div>

              {bpmnSummary ? (
                <div style={{ marginTop: 10, fontWeight: 700, lineHeight: 1.6 }}>
                  {bpmnSummary}
                </div>
              ) : (
                <div style={{ color: "#888", marginTop: 10 }}>No summary generated yet.</div>
              )}

              <div style={{ color: "#888", marginTop: 10, fontSize: 13 }}>
                Generated from extracted process/tasks.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: "#888", marginTop: 12 }}>
          Upload a BPMN file to see well-formed check, warnings, errors, and summary.
        </div>
      )}
    </Card>
  );
}