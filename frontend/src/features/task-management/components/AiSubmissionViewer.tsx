import { useEffect, useRef, useState } from "react";
import { getAiSubmission } from "../api/taskManagementApi";
import type { AiSubmissionResponse, AiGeneratedFileItem } from "../types";
import { ui } from "../../../theme/ui";

declare global {
  interface Window {
    Prism?: {
      highlightAllUnder: (root: Element) => void;
      highlightElement: (el: Element) => void;
    };
  }
}

type Props = {
  assignmentId: number;
};

export default function AiSubmissionViewer({ assignmentId }: Props) {
  const [data, setData] = useState<AiSubmissionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFile, setActiveFile] = useState<AiGeneratedFileItem | null>(null);
  const codeContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getAiSubmission(assignmentId)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        const first = res.latest?.files?.[0] ?? null;
        setActiveFile(first);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Failed to load AI submission.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  useEffect(() => {
    if (!activeFile) return;
    if (!codeContainerRef.current) return;
    if (!window.Prism) return;
    window.Prism.highlightAllUnder(codeContainerRef.current);
  }, [activeFile]);

  if (loading) {
    return <div style={{ color: ui.colors.textMuted }}>Loading AI submission...</div>;
  }
  if (error) {
    return <div style={{ color: ui.colors.danger, fontWeight: 700 }}>{error}</div>;
  }
  if (!data || !data.latest) {
    return (
      <div style={{ color: ui.colors.textMuted }}>
        No AI submission has been produced for this task yet.
      </div>
    );
  }

  const latest = data.latest;
  const files = latest.files;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          fontSize: 12,
          color: ui.colors.textMuted,
        }}
      >
        <span>
          <strong style={{ color: ui.colors.text }}>Attempt {latest.attemptNumber}</strong>
        </span>
        <span>Model: {latest.modelUsed}</span>
        <span>Tokens: {latest.tokensUsed}</span>
        {data.history.length > 1 && (
          <span>(History: {data.history.length} attempts)</span>
        )}
      </div>

      <div
        style={{
          padding: 12,
          borderRadius: 8,
          background: "#fff",
          border: `1px solid ${ui.colors.border}`,
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6 }}>AI explanation</div>
        <div>{latest.explanation || "(no explanation)"}</div>
      </div>

      {files.length === 0 ? (
        <div style={{ color: ui.colors.textMuted }}>(no files generated)</div>
      ) : (
        <div
          style={{
            border: `1px solid ${ui.colors.border}`,
            borderRadius: 8,
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              padding: 8,
              borderBottom: `1px solid ${ui.colors.border}`,
              background: ui.colors.bgSoft,
            }}
          >
            {files.map((f) => {
              const isActive = activeFile?.id === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFile(f)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${isActive ? ui.colors.primary : ui.colors.border}`,
                    background: isActive ? ui.colors.primarySoft : "#fff",
                    color: isActive ? ui.colors.primary : ui.colors.text,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {f.filename}
                </button>
              );
            })}
          </div>

          <div
            ref={codeContainerRef}
            style={{
              maxHeight: 480,
              overflow: "auto",
              padding: 0,
              margin: 0,
            }}
          >
            {activeFile && (
              <pre
                style={{
                  margin: 0,
                  padding: 14,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <code className={`language-${activeFile.language || "python"}`}>
                  {activeFile.content}
                </code>
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}