import { Card } from "../ProjectUi";
import type { ProjectDetailApi } from "../../../../../api/types";

type Props = {
  members: ProjectDetailApi["members"];
};

export default function MembersTab({ members }: Props) {
  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Members</h3>

      {members.length === 0 ? (
        <div style={{ color: "#888" }}>No members.</div>
      ) : (
        members.map((member) => (
          <div
            key={member.id}
            style={{ borderTop: "1px solid #eee", paddingTop: 10, marginTop: 10 }}
          >
            <div style={{ fontWeight: 800 }}>{member.username}</div>
            <div style={{ color: "#666" }}>{member.role}</div>
          </div>
        ))
      )}
    </Card>
  );
}