import React, { useEffect } from "react";
import { buttonBase, ui } from "../theme/ui";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const accent = danger ? ui.colors.danger : ui.colors.primary;
  const softBg = danger ? ui.colors.dangerSoft : ui.colors.primarySoft;
  const iconBorder = danger ? "#fecaca" : "#bfdbfe";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: ui.colors.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 18,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
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
            background: softBg,
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
              border: `1px solid ${iconBorder}`,
              display: "grid",
              placeItems: "center",
              color: accent,
              fontWeight: 900,
              fontSize: 18,
              boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
            }}
            aria-hidden
          >
            {danger ? "!" : "i"}
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

        <div style={{ padding: "20px 18px 4px" }}>
          <p
            style={{
              color: ui.colors.textSoft,
              marginTop: 0,
              lineHeight: 1.7,
              fontSize: 15,
            }}
          >
            {message}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            padding: 18,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              ...buttonBase,
              border: `1px solid ${ui.colors.borderStrong}`,
              background: "#fff",
              color: ui.colors.text,
            }}
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            style={{
              ...buttonBase,
              border: "1px solid transparent",
              background: accent,
              color: "#fff",
              boxShadow: danger
                ? "0 12px 28px rgba(185,28,28,0.22)"
                : "0 12px 28px rgba(15,61,145,0.22)",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}