import { useEffect, useState } from "react";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../api/taskManagementApi";
import { buttonBase, cardBase, ui } from "../../../theme/ui";

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

export default function MyNotificationsCard() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await getMyNotifications();
      setItems(data.items || []);
      setUnreadCount(data.unreadCount || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleRead(notificationId: number) {
    await markNotificationRead(notificationId);
    await loadNotifications();
  }

  async function handleReadAll() {
    await markAllNotificationsRead();
    await loadNotifications();
  }

  return (
    <div style={{ ...cardBase, overflow: "hidden" }}>
      <div
        style={{
          padding: 18,
          borderBottom: `1px solid ${ui.colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: ui.colors.text }}>Notifications</h3>
          <div style={{ color: ui.colors.textMuted, marginTop: 6, fontSize: 14 }}>
            Task assignment, review, and evaluation updates.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span
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
          </span>

          <button
            onClick={handleReadAll}
            disabled={unreadCount === 0}
            style={{
              ...buttonBase,
              padding: "8px 12px",
              border: `1px solid ${ui.colors.borderStrong}`,
              background: "#fff",
              color: ui.colors.text,
              opacity: unreadCount === 0 ? 0.6 : 1,
            }}
          >
            Mark all as read
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, padding: 18 }}>
        {loading ? (
          <div style={{ color: ui.colors.textMuted }}>Loading notifications...</div>
        ) : items.length === 0 ? (
          <div style={{ color: ui.colors.textMuted }}>No notifications yet.</div>
        ) : (
          items.map((item) => {
            const tone = typeTone(item.type);

            return (
              <div
                key={item.id}
                style={{
                  border: `1px solid ${item.isRead ? ui.colors.border : "#bfdbfe"}`,
                  borderRadius: ui.radius.lg,
                  padding: 16,
                  background: item.isRead ? "#fff" : "#f8fbff",
                  boxShadow: item.isRead ? "none" : "0 8px 18px rgba(15,61,145,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "start",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900, color: ui.colors.text }}>{item.title}</div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "5px 10px",
                          borderRadius: 999,
                          background: tone.bg,
                          color: tone.color,
                          fontWeight: 800,
                          fontSize: 12,
                          border: `1px solid ${ui.colors.border}`,
                        }}
                      >
                        {tone.label}
                      </span>
                      {!item.isRead ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "5px 10px",
                            borderRadius: 999,
                            background: ui.colors.primarySoft,
                            color: ui.colors.primary,
                            fontWeight: 800,
                            fontSize: 12,
                            border: `1px solid ${ui.colors.border}`,
                          }}
                        >
                          New
                        </span>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 8, color: ui.colors.text, lineHeight: 1.65 }}>
                      {item.message}
                    </div>

                    <div style={{ marginTop: 10, fontSize: 12, color: ui.colors.textMuted }}>
                      {item.project?.name ? `${item.project.name} • ` : ""}
                      {formatWhen(item.createdAt)}
                    </div>
                  </div>

                  {!item.isRead ? (
                    <button
                      onClick={() => handleRead(item.id)}
                      style={{
                        ...buttonBase,
                        padding: "8px 12px",
                        border: `1px solid ${ui.colors.borderStrong}`,
                        background: "#fff",
                        color: ui.colors.text,
                      }}
                    >
                      Mark as read
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}