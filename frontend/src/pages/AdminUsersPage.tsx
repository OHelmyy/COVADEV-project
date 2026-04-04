import { useEffect, useState } from "react";
import type { Role } from "../api/auth";
import {
  adminCreateUser,
  adminDeleteUser,
  adminListUsers,
  adminUpdateUser,
  type AdminUser,
} from "../api/adminUsers";
import ConfirmModal from "../components/ConfirmModal";
import { buttonBase, cardBase, inputBase, ui } from "../theme/ui";

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: ui.colors.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 999,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(620px, 100%)",
          background: "#fff",
          borderRadius: ui.radius.xl,
          border: `1px solid ${ui.colors.border}`,
          boxShadow: ui.shadow.lg,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 18px",
            borderBottom: `1px solid ${ui.colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: ui.colors.bgSoft,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18, color: ui.colors.text }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              ...buttonBase,
              padding: "8px 10px",
              border: `1px solid ${ui.colors.borderStrong}`,
              background: "#fff",
              color: ui.colors.text,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("DEVELOPER");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function refresh() {
    setErr("");
    setLoading(true);
    try {
      const res = await adminListUsers();
      setUsers(res.users);
    } catch (e: any) {
      setErr(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetCreateForm() {
    setEmail("");
    setFullName("");
    setRole("DEVELOPER");
    setPassword("");
    setIsActive(true);
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    try {
      await adminCreateUser({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role,
        password,
        isActive,
      });

      resetCreateForm();
      setOpenCreate(false);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    }
  }

  async function toggleActive(u: AdminUser) {
    try {
      await adminUpdateUser(u.id, { isActive: !u.isActive });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Update failed");
    }
  }

  async function changeRole(u: AdminUser, newRole: Role) {
    try {
      await adminUpdateUser(u.id, { role: newRole });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Update failed");
    }
  }

  async function removeConfirmed() {
    if (!deleteTarget) return;

    setErr("");
    try {
      await adminDeleteUser(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
      setDeleteTarget(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          ...cardBase,
          padding: 18,
          background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 24 }}>Manage Users</h2>
          <div style={{ marginTop: 8, opacity: 0.95 }}>
            Create, manage, activate, and organize system users.
          </div>
        </div>

        <button
          onClick={() => setOpenCreate(true)}
          style={{
            ...buttonBase,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "#fff",
            color: ui.colors.primary,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          + Create User
        </button>
      </div>

      {err ? (
        <div
          style={{
            ...cardBase,
            padding: 14,
            background: ui.colors.dangerSoft,
            borderColor: "#fecaca",
            color: ui.colors.danger,
            fontWeight: 700,
          }}
        >
          {err}
        </div>
      ) : null}

      {loading ? (
        <div style={{ ...cardBase, padding: 18 }}>Loading...</div>
      ) : (
        <div style={{ ...cardBase, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ textAlign: "left", background: ui.colors.bgSoft }}>
                  <th style={{ padding: 14 }}>Email</th>
                  <th style={{ padding: 14 }}>Full Name</th>
                  <th style={{ padding: 14 }}>Role</th>
                  <th style={{ padding: 14 }}>Active</th>
                  <th style={{ padding: 14 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                      {u.email}
                    </td>
                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                      {u.fullName}
                    </td>

                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value as Role)}
                        style={{ ...inputBase, padding: "8px 10px" }}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="EVALUATOR">EVALUATOR</option>
                        <option value="DEVELOPER">DEVELOPER</option>
                      </select>
                    </td>

                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                      <button
                        onClick={() => toggleActive(u)}
                        style={{
                          ...buttonBase,
                          padding: "8px 12px",
                          border: `1px solid ${u.isActive ? "#bbf7d0" : "#fecaca"}`,
                          background: u.isActive ? ui.colors.successSoft : ui.colors.dangerSoft,
                          color: u.isActive ? ui.colors.success : ui.colors.danger,
                        }}
                      >
                        {u.isActive ? "Active" : "Disabled"}
                      </button>
                    </td>

                    <td style={{ padding: 14, borderBottom: `1px solid ${ui.colors.border}` }}>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        style={{
                          ...buttonBase,
                          padding: "8px 12px",
                          border: "1px solid #fecaca",
                          background: ui.colors.dangerSoft,
                          color: ui.colors.danger,
                          fontWeight: 800,
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {users.length === 0 ? (
                  <tr>
                    <td style={{ padding: 20, color: ui.colors.textMuted, textAlign: "center" }} colSpan={5}>
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={openCreate}
        title="Create User"
        onClose={() => {
          setOpenCreate(false);
        }}
      >
        <form onSubmit={createUser} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 700, color: ui.colors.textSoft }}>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...inputBase, width: "100%" }}
              required
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 700, color: ui.colors.textSoft }}>Full Name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ ...inputBase, width: "100%" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 700, color: ui.colors.textSoft }}>Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              style={{ ...inputBase, width: "100%" }}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="EVALUATOR">EVALUATOR</option>
              <option value="DEVELOPER">DEVELOPER</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 700, color: ui.colors.textSoft }}>Temporary Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputBase, width: "100%" }}
              required
            />
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "center", color: ui.colors.textSoft }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setOpenCreate(false)}
              style={{
                ...buttonBase,
                border: `1px solid ${ui.colors.borderStrong}`,
                background: "#fff",
                color: ui.colors.text,
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              style={{
                ...buttonBase,
                border: "1px solid transparent",
                background: ui.colors.primary,
                color: "#fff",
                fontWeight: 900,
              }}
            >
              Create
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete user?"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.email}" permanently? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeConfirmed}
      />
    </div>
  );
}