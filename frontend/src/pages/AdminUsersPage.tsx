import { useEffect, useState } from "react";
import type { Role } from "../api/auth";
import {
  adminCreateUser,
  adminDeleteUser,
  adminListUsers,
  adminUpdateUser,
  type AdminUser,
} from "../api/adminUsers";

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
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 999,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #eee",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 800 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              border: "1px solid #ddd",
              background: "#fff",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // modal state
  const [openCreate, setOpenCreate] = useState(false);

  // create form fields
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

  async function remove(u: AdminUser) {
    if (!confirm(`Delete user ${u.email}?`)) return;
    setErr("");
    try {
      await adminDeleteUser(u.id);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Manage Users</h2>

        <button
          onClick={() => setOpenCreate(true)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #094780",
            background: "#094780",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Create User
        </button>
      </div>

      {err && (
        <div
          style={{
            background: "#fff3f3",
            border: "1px solid #ffd0d0",
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: 10 }}>Email</th>
                <th style={{ padding: 10 }}>Full Name</th>
                <th style={{ padding: 10 }}>Role</th>
                <th style={{ padding: 10 }}>Active</th>
                <th style={{ padding: 10 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                  <td style={{ padding: 10 }}>{u.email}</td>
                  <td style={{ padding: 10 }}>{u.fullName}</td>

                  <td style={{ padding: 10 }}>
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="EVALUATOR">EVALUATOR</option>
                      <option value="DEVELOPER">DEVELOPER</option>
                    </select>
                  </td>

                  <td style={{ padding: 10 }}>
                    <button
                      onClick={() => toggleActive(u)}
                      style={{
                        border: "1px solid #ddd",
                        background: "#fff",
                        padding: "6px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      {u.isActive ? "Active" : "Disabled"}
                    </button>
                  </td>

                  <td style={{ padding: 10 }}>
                    <button
                      onClick={() => remove(u)}
                      style={{
                        border: "1px solid #ff4d4f",
                        color: "#ff4d4f",
                        background: "transparent",
                        padding: "6px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 800,
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td style={{ padding: 10 }} colSpan={5}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE USER MODAL */}
      <Modal
        open={openCreate}
        title="Create User"
        onClose={() => {
          setOpenCreate(false);
          // optional: reset form when closing
          // resetCreateForm();
        }}
      >
        <form onSubmit={createUser} style={{ display: "grid", gap: 10 }}>
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ddd",
                marginTop: 6,
              }}
              required
            />
          </label>

          <label>
            Full Name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ddd",
                marginTop: 6,
              }}
            />
          </label>

          <label>
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ddd",
                marginTop: 6,
              }}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="EVALUATOR">EVALUATOR</option>
              <option value="DEVELOPER">DEVELOPER</option>
            </select>
          </label>

          <label>
            Temporary Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ddd",
                marginTop: 6,
              }}
              required
            />
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => {
                setOpenCreate(false);
              }}
              style={{
                border: "1px solid #ddd",
                background: "#fff",
                padding: "10px 12px",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #094780",
                background: "#094780",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}