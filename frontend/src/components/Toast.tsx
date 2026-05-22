import { useCallback, useEffect, useRef, useState } from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; icon: string; color: string }> = {
  success: { bg: "#f0fdf4", border: "#86efac", icon: "✅", color: "#15803d" },
  error:   { bg: "#fef2f2", border: "#fca5a5", icon: "❌", color: "#dc2626" },
  warning: { bg: "#fff7ed", border: "#fdba74", icon: "⚠️", color: "#c2410c" },
  info:    { bg: "#eff6ff", border: "#93c5fd", icon: "ℹ️", color: "#1d4ed8" },
};

let _nextId = 1;
type Listener = (toasts: ToastItem[]) => void;
let _toasts: ToastItem[] = [];
const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach((l) => l([..._toasts]));
}

export function pushToast(message: string, variant: ToastVariant = "info", duration = 4000) {
  const id = _nextId++;
  _toasts = [..._toasts, { id, message, variant }];
  notify();
  if (duration > 0) {
    setTimeout(() => {
      _toasts = _toasts.filter((t) => t.id !== id);
      notify();
    }, duration);
  }
  return id;
}

export function dismissToast(id: number) {
  _toasts = _toasts.filter((t) => t.id !== id);
  notify();
}

/** Drop-in hook — call anywhere, no provider needed */
export function useToast() {
  return {
    success: (msg: string) => pushToast(msg, "success"),
    error:   (msg: string) => pushToast(msg, "error", 6000),
    warning: (msg: string) => pushToast(msg, "warning"),
    info:    (msg: string) => pushToast(msg, "info"),
  };
}

/** Mount once near the app root */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (t) => setToasts(t);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const s = VARIANT_STYLES[toast.variant];
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Trigger slide-in on mount
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      ref={ref}
      style={{
        pointerEvents: "all",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        minWidth: 280,
        maxWidth: 380,
        padding: "13px 16px",
        borderRadius: 12,
        background: s.bg,
        border: `1.5px solid ${s.border}`,
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        transform: visible ? "translateX(0)" : "translateX(120%)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease",
        cursor: "default",
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>{s.icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: s.color, lineHeight: 1.5, flex: 1 }}>
        {toast.message}
      </span>
      <button
        onClick={() => dismissToast(toast.id)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: s.color,
          fontSize: 15,
          lineHeight: 1,
          opacity: 0.6,
          padding: 0,
          flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
