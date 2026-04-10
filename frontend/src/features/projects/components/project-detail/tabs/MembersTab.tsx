import { useEffect, useMemo, useState } from "react";
import { Card } from "../ProjectUi";
import ConfirmModal from "../../../../../components/ConfirmModal";
import ErrorModal from "../../../../../components/ErrorModal";
import { buildProjectError } from "../../..//utils/projectError";
import {
  addProjectMember,
  fetchProjectMembers,
  removeProjectMember,
  type ProjectMember,
} from "../../../../../api/projectMembers";
import { adminListUsers, type AdminUser } from "../../../../../api/adminUsers";

type Props = {
  projectId: number;
  initialMembers: ProjectMember[];
  currentUserRole?: string | null;
  evaluator?: {
    id: number;
    username: string | null;
    email: string | null;
  } | null;
};

export default function MembersTab({
  projectId,
  initialMembers,
  currentUserRole,
  evaluator,
}: Props) {
  const [members, setMembers] = useState<ProjectMember[]>(initialMembers || []);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [submittingRemove, setSubmittingRemove] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");

  const [removeTarget, setRemoveTarget] = useState<ProjectMember | null>(null);

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{
    title: string;
    message: string;
    cause: string;
    details: string;
  } | null>(null);

  const canManageMembers = currentUserRole === "ADMIN";

  async function loadMembers() {
    try {
      setLoadingMembers(true);
      const res = await fetchProjectMembers(projectId);
      setMembers(res.members || []);
    } catch (error) {
      const info = buildProjectError("load project members", error, "Failed to load members");
      setErrorInfo(info);
      setErrorOpen(true);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadAvailableUsers() {
    if (!canManageMembers) return;

    try {
      setLoadingUsers(true);
      const res = await adminListUsers();
      setAllUsers(res.users || []);
    } catch (error) {
      const info = buildProjectError("load available developers", error, "Failed to load users");
      setErrorInfo(info);
      setErrorOpen(true);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, [projectId]);

  useEffect(() => {
    if (canManageMembers) {
      loadAvailableUsers();
    }
  }, [projectId, canManageMembers]);

  const availableDevelopers = useMemo(() => {
    const memberEmails = new Set(members.map((m) => (m.email || "").toLowerCase()));
    const evaluatorEmail = (evaluator?.email || "").toLowerCase();
    const q = search.trim().toLowerCase();

    return allUsers
      .filter((u) => u.role === "DEVELOPER")
      .filter((u) => !memberEmails.has((u.email || "").toLowerCase()))
      .filter((u) => (u.email || "").toLowerCase() !== evaluatorEmail)
      .filter((u) => {
        if (!q) return true;

        const email = (u.email || "").toLowerCase();
        const fullName = (u.fullName || "").toLowerCase();
        return email.includes(q) || fullName.includes(q);
      })
      .sort((a, b) => {
        const aName = (a.fullName || a.email || "").toLowerCase();
        const bName = (b.fullName || b.email || "").toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [allUsers, members, evaluator, search]);

  async function handleAddSelected() {
    if (!selectedUser?.email) return;

    try {
      setSubmittingAdd(true);
      setSuccessMessage("");

      await addProjectMember(projectId, selectedUser.email);
      setSelectedUser(null);
      setSearch("");
      setSuccessMessage("Developer added successfully.");

      await Promise.all([loadMembers(), loadAvailableUsers()]);
    } catch (error) {
      const info = buildProjectError("add project member", error, "Failed to add member");
      setErrorInfo(info);
      setErrorOpen(true);
    } finally {
      setSubmittingAdd(false);
    }
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;

    try {
      setSubmittingRemove(true);
      setSuccessMessage("");

      await removeProjectMember(projectId, removeTarget.id);
      setSuccessMessage("Member removed successfully.");
      setRemoveTarget(null);

      await Promise.all([loadMembers(), loadAvailableUsers()]);
    } catch (error) {
      const info = buildProjectError("remove project member", error, "Failed to remove member");
      setErrorInfo(info);
      setErrorOpen(true);
    } finally {
      setSubmittingRemove(false);
    }
  }

  return (
    <>
      <Card>
        <h3 style={{ marginTop: 0 }}>Members</h3>

        {successMessage ? (
          <div
            style={{
              marginTop: 12,
              marginBottom: 12,
              padding: 12,
              borderRadius: 10,
              background: "#f3f8f4",
              color: "#25643b",
              border: "1px solid #cfe8d4",
              fontWeight: 700,
            }}
          >
            {successMessage}
          </div>
        ) : null}

        {canManageMembers ? (
          <div
            style={{
              marginTop: 14,
              marginBottom: 18,
              padding: 14,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "#fafcff",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Add developer</div>

            <input
              type="text"
              placeholder="Search by email or full name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedUser(null);
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                outline: "none",
                marginBottom: 12,
              }}
            />

            <div
              style={{
                maxHeight: 220,
                overflowY: "auto",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: "#fff",
              }}
            >
              {loadingUsers ? (
                <div style={{ padding: 12, color: "#666" }}>Loading developers...</div>
              ) : availableDevelopers.length === 0 ? (
                <div style={{ padding: 12, color: "#888" }}>No available developers found.</div>
              ) : (
                availableDevelopers.map((user) => {
                  const isSelected = selectedUser?.id === user.id;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUser(user)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: 12,
                        border: "none",
                        borderBottom: "1px solid #f1f5f9",
                        background: isSelected ? "#eef4ff" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 800, color: "#111827" }}>
                        {user.fullName || user.email}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 14 }}>{user.email}</div>
                    </button>
                  );
                })
              )}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ color: "#6b7280", fontSize: 14 }}>
                {selectedUser ? (
                  <>
                    Selected: <b>{selectedUser.fullName || selectedUser.email}</b>
                  </>
                ) : (
                  "Select a developer from the list."
                )}
              </div>

              <button
                type="button"
                onClick={handleAddSelected}
                disabled={!selectedUser || submittingAdd}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: !selectedUser || submittingAdd ? "#cbd5e1" : "#094780",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: !selectedUser || submittingAdd ? "not-allowed" : "pointer",
                }}
              >
                {submittingAdd ? "Adding..." : "Add Selected Developer"}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: 12,
              marginBottom: 18,
              padding: 12,
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              color: "#64748b",
            }}
          >
            Only admins can add or remove project members.
          </div>
        )}

        <div style={{ fontWeight: 800, marginBottom: 10 }}>Current members</div>

        {loadingMembers ? (
          <div style={{ color: "#888" }}>Loading members...</div>
        ) : members.length === 0 ? (
          <div style={{ color: "#888" }}>No members assigned to this project.</div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              style={{
                borderTop: "1px solid #eee",
                paddingTop: 12,
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{member.username}</div>
                <div style={{ color: "#666" }}>{member.email}</div>
                <div style={{ color: "#888", fontSize: 13 }}>{member.role}</div>
              </div>

              {canManageMembers ? (
                <button
                  type="button"
                  onClick={() => setRemoveTarget(member)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #f1c7c7",
                    background: "#fff5f5",
                    color: "#b33a3a",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))
        )}
      </Card>

      <ConfirmModal
        open={!!removeTarget}
        title="Remove member"
        message={
          removeTarget
            ? `Remove "${removeTarget.username}" from this project? This action will remove the member from the project assignment list.`
            : ""
        }
        confirmText={submittingRemove ? "Removing..." : "Remove"}
        cancelText="Cancel"
        danger
        onConfirm={handleConfirmRemove}
        onCancel={() => {
          if (!submittingRemove) setRemoveTarget(null);
        }}
      />

      <ErrorModal
        open={errorOpen && !!errorInfo}
        title={errorInfo?.title || "Something went wrong"}
        message={errorInfo?.message || "The action could not be completed."}
        cause={errorInfo?.cause}
        details={errorInfo?.details}
        onClose={() => {
          setErrorOpen(false);
          setErrorInfo(null);
        }}
      />
    </>
  );
}