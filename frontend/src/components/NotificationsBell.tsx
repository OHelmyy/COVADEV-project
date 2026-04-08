import { useEffect, useMemo, useState } from "react";
import {
    getMyNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    type NotificationItem,
  } from "../features/task-management/api/taskManagementApi";
  import { buttonBase, cardBase, ui } from "../theme/ui";
function typeTone(type: string) {
  if (type === "TASK_ASSIGNED") {
    return {
      bg: ui.colors.primarySoft,
      color: ui.colors.primary,
      label: "Assigned",
    };
  }

  if (type === "TASK_REVIEWED") {
    return {
      bg: ui.colors.warningSoft,
      color: ui.colors.warning,
      label: "Reviewed",
    };
  }

  return {
    bg: ui.colors.successSoft,
    color: ui.colors.success,
    label: "Evaluated",
  };
}

function formatWhen(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString();
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await getMyNotifications();
      setItems(data.items || []);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items]
  );

  async function handleMarkRead(notificationId: number) {
    try {
      setBusy(true);
      await markNotificationRead(notificationId);
      setItems((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                isRead: true,
                readAt: new Date().toISOString(),
              }
            : item
        )
      );
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkAllRead() {
    try {
      setBusy(true);
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || now,
        }))
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read", error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "relative",
          width: 42,
          height: 42,
          borderRadius: 12,
          border: `1px solid ${ui.colors.border}`,
          background: "#fff",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
        }}
        title="Notifications"
      >
        <span style={{ fontSize: 18 }}>🔔</span>

        {unreadCount > 0 ? (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              minWidth: 20,
              height: 20,
              borderRadius: 999,
              background: ui.colors.danger,
              color: "#fff",
              fontSize: 11,
              fontWeight: 900,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 6px",
              border: "2px solid #fff",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(15,23,42,0.35)",
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              width: "min(440px, 100vw)",
              height: "100vh",
              background: "#fff",
              boxShadow: "-10px 0 30px rgba(15,23,42,0.18)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: 18,
                borderBottom: `1px solid ${ui.colors.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: ui.colors.text }}>Notifications</h3>
                <div style={{ marginTop: 6, fontSize: 13, color: ui.colors.textMuted }}>
                  Assignment, review, and evaluation updates.
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                style={{
                  ...buttonBase,
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  border: `1px solid ${ui.colors.border}`,
                  background: "#fff",
                  color: ui.colors.text,
                  fontSize: 18,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: 16,
                borderBottom: `1px solid ${ui.colors.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: unreadCount > 0 ? ui.colors.primarySoft : ui.colors.bgSoft,
                  color: unreadCount > 0 ? ui.colors.primary : ui.colors.textMuted,
                  border: `1px solid ${ui.colors.border}`,
                  fontWeight: 900,
                }}
              >
                {unreadCount} unread
              </div>

              <button
                onClick={handleMarkAllRead}
                disabled={busy || unreadCount === 0}
                style={{
                  ...buttonBase,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1px solid ${ui.colors.border}`,
                  background: "#fff",
                  color: ui.colors.text,
                  opacity: busy || unreadCount === 0 ? 0.6 : 1,
                }}
              >
                Mark all as read
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                background: "#f8fafc",
                display: "grid",
                gap: 12,
              }}
            >
              {loading ? (
                <div style={{ ...cardBase, padding: 16, color: ui.colors.textMuted }}>
                  Loading notifications...
                </div>
              ) : items.length === 0 ? (
                <div style={{ ...cardBase, padding: 16, color: ui.colors.textMuted }}>
                  No notifications yet.
                </div>
              ) : (
                items.map((item) => {
                  const tone = typeTone(item.type);

                  return (
                    <div
                      key={item.id}
                      style={{
                        ...cardBase,
                        padding: 14,
                        border: `1px solid ${item.isRead ? ui.colors.border : "#bfdbfe"}`,
                        background: item.isRead ? "#fff" : "#f8fbff",
                        boxShadow: item.isRead
                          ? "0 6px 18px rgba(15,23,42,0.04)"
                          : "0 12px 24px rgba(15,61,145,0.09)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "start",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ fontWeight: 900, color: ui.colors.text }}>
                              {item.title}
                            </div>

                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "4px 9px",
                                borderRadius: 999,
                                background: tone.bg,
                                color: tone.color,
                                border: `1px solid ${ui.colors.border}`,
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            >
                              {tone.label}
                            </span>

                            {!item.isRead ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "4px 9px",
                                  borderRadius: 999,
                                  background: ui.colors.primarySoft,
                                  color: ui.colors.primary,
                                  border: `1px solid ${ui.colors.border}`,
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                New
                              </span>
                            ) : null}
                          </div>

                          <div
                            style={{
                              marginTop: 8,
                              color: ui.colors.text,
                              lineHeight: 1.65,
                              fontSize: 14,
                            }}
                          >
                            {item.message}
                          </div>

                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 12,
                              color: ui.colors.textMuted,
                            }}
                          >
                            {item.project?.name ? `${item.project.name} • ` : ""}
                            {formatWhen(item.createdAt)}
                          </div>
                        </div>

                        {!item.isRead ? (
                          <button
                            onClick={() => handleMarkRead(item.id)}
                            disabled={busy}
                            style={{
                              ...buttonBase,
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: `1px solid ${ui.colors.border}`,
                              background: "#fff",
                              color: ui.colors.text,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Read
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}