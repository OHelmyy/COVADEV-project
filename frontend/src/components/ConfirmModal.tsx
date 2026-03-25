import React, { useEffect } from "react";

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
  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const accent = danger ? "#c62828" : "#094780";
  const softBg = danger ? "#fff3f3" : "#f3f7ff";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        // click outside closes
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #eee",
          boxShadow: "0 24px 70px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 16px",
            background: softBg,
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "#fff",
              border: `1px solid ${danger ? "#ffd0d0" : "#d7e6ff"}`,
              display: "grid",
              placeItems: "center",
              color: accent,
              fontWeight: 900,
            }}
            aria-hidden
          >
            {danger ? "!" : "i"}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, color: "#111", lineHeight: 1.2 }}>{title}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              Press <b>Esc</b> to close
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 16px 0 16px" }}>
          <p style={{ color: "#555", marginTop: 0, lineHeight: 1.6 }}>{message}</p>
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            padding: 16,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              color: "#222",
            }}
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid transparent",
              background: accent,
              color: "#fff",
              cursor: "pointer",
              fontWeight: 800,
              boxShadow: danger ? "0 10px 22px rgba(198,40,40,0.25)" : "0 10px 22px rgba(9,71,128,0.20)",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}