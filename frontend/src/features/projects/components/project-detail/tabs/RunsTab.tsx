import { Card } from "../ProjectUi";
import type { ProjectDetailApi } from "../../../../../api/types";

type Props = {
  runs: ProjectDetailApi["runs"];
};

export default function RunsTab({ runs }: Props) {
  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Analysis Runs (latest 10)</h3>

      {runs.length === 0 ? (
        <div style={{ color: "#888" }}>No runs yet.</div>
      ) : (
        runs.map((run) => (
          <div key={run.id} style={{ borderTop: "1px solid #eee", paddingTop: 10, marginTop: 10 }}>
            <div style={{ fontWeight: 800 }}>
              Run #{run.id} — {run.status}
            </div>
            <div style={{ color: "#888", fontSize: 13 }}>
              Started: {run.startedAt ?? "—"} | Finished: {run.finishedAt ?? "—"}
            </div>
            {run.errorMessage ? (
              <div style={{ color: "#a00", marginTop: 6 }}>
                Error: {run.errorMessage}
              </div>
            ) : null}
          </div>
        ))
      )}
    </Card>
  );
}