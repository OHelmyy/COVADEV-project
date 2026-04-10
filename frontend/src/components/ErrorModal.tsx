import React, { useEffect } from "react";
import { buttonBase, ui } from "../theme/ui";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  cause?: string;
  details?: string;
  onClose: () => void;
};

export default function ErrorModal({
  open,
  title = "Something went wrong",
  message,
  cause,
  details,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: ui.colors.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: 18,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)",
          background: "#fff",
          borderRadius: ui.radius.xl,
          border: `1px solid ${ui.colors.border}`,
          boxShadow: ui.shadow.lg,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 18px 16px",
            background: ui.colors.dangerSoft,
            borderBottom: `1px solid ${ui.colors.border}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: "#fff",
              border: "1px solid #fecaca",
              display: "grid",
              placeItems: "center",
              color: ui.colors.danger,
              fontWeight: 900,
              fontSize: 18,
            }}
            aria-hidden
          >
            !
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 900,
                color: ui.colors.text,
                lineHeight: 1.2,
                fontSize: 18,
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>
              Press <b>Esc</b> to close
            </div>
          </div>
        </div>

        <div style={{ padding: 18, display: "grid", gap: 14 }}>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: ui.colors.textMuted,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Error
            </div>
            <div
              style={{
                color: ui.colors.text,
                lineHeight: 1.7,
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {message}
            </div>
          </div>

          {cause ? (
            <div
              style={{
                border: `1px solid ${ui.colors.border}`,
                background: ui.colors.bgSoft,
                borderRadius: ui.radius.lg,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: ui.colors.textMuted,
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Likely cause
              </div>
              <div style={{ color: ui.colors.textSoft, lineHeight: 1.7 }}>{cause}</div>
            </div>
          ) : null}

          {details ? (
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: ui.colors.textMuted,
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Technical details
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  padding: 14,
                  borderRadius: ui.radius.lg,
                  fontSize: 12,
                  lineHeight: 1.6,
                  overflowX: "auto",
                }}
              >
                {details}
              </pre>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: 18,
            borderTop: `1px solid ${ui.colors.border}`,
          }}
        >
          <button
            onClick={onClose}
            style={{
              ...buttonBase,
              border: `1px solid ${ui.colors.borderStrong}`,
              background: "#fff",
              color: ui.colors.text,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}