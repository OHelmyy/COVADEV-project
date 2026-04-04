import { cardBase, ui } from "../theme/ui";

type DevScore = {
  name: string;
  matched: number;
  missing: number;
  extra: number;
  precision: number;
  recall: number;
  f1: number;
  score: number;
};

function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

export default function DevelopersPage() {
  const devs: DevScore[] = [
    { name: "Helmy", matched: 18, missing: 3, extra: 2, precision: 0.86, recall: 0.83, f1: 0.84, score: 88 },
    { name: "Serag", matched: 20, missing: 2, extra: 3, precision: 0.84, recall: 0.91, f1: 0.87, score: 90 },
    { name: "Mostafa", matched: 16, missing: 5, extra: 1, precision: 0.89, recall: 0.76, f1: 0.82, score: 84 },
    { name: "Bassel", matched: 14, missing: 4, extra: 0, precision: 0.92, recall: 0.78, f1: 0.84, score: 86 },
  ];

  const top = [...devs].sort((a, b) => b.score - a.score)[0];
  const avgF1 = devs.reduce((s, d) => s + d.f1, 0) / devs.length;
  const totalTasks = devs.reduce((s, d) => s + d.matched + d.missing, 0);
  const maxScore = Math.max(...devs.map((d) => d.score));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          ...cardBase,
          padding: 20,
          background: "linear-gradient(135deg, #0f3d91 0%, #6d28d9 100%)",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>Developers</h1>
        <p style={{ marginTop: 8, opacity: 0.96 }}>
          Developer comparison dashboard for traceability and evaluation metrics.
        </p>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ ...cardBase, padding: 18, minWidth: 250 }}>
          <div style={{ fontSize: 13, color: ui.colors.textMuted }}>Top Performer</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{top.name}</div>
          <div style={{ fontSize: 13, color: ui.colors.textMuted, marginTop: 8 }}>
            Score: {top.score}/100
          </div>
        </div>

        <div style={{ ...cardBase, padding: 18, minWidth: 250 }}>
          <div style={{ fontSize: 13, color: ui.colors.textMuted }}>Average F1</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{pct(avgF1)}</div>
          <div style={{ fontSize: 13, color: ui.colors.textMuted, marginTop: 8 }}>
            Across all developers
          </div>
        </div>

        <div style={{ ...cardBase, padding: 18, minWidth: 250 }}>
          <div style={{ fontSize: 13, color: ui.colors.textMuted }}>Total Tasks</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{totalTasks}</div>
          <div style={{ fontSize: 13, color: ui.colors.textMuted, marginTop: 8 }}>
            BPMN workload overview
          </div>
        </div>
      </div>

      <div style={{ ...cardBase, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Overall Score</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {devs
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((d) => (
              <div
                key={d.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr 60px",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 800 }}>{d.name}</div>
                <div
                  style={{
                    height: 14,
                    borderRadius: 999,
                    background: ui.colors.bgSoft,
                    overflow: "hidden",
                    border: `1px solid ${ui.colors.border}`,
                  }}
                >
                  <div
                    style={{
                      width: `${(d.score / maxScore) * 100}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #0f3d91 0%, #06b6d4 100%)",
                    }}
                  />
                </div>
                <div style={{ fontWeight: 900, textAlign: "right" }}>{d.score}</div>
              </div>
            ))}
        </div>
      </div>

      <div style={{ ...cardBase, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ textAlign: "left", background: ui.colors.bgSoft }}>
              <th style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>Developer</th>
              <th style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>Matched</th>
              <th style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>Missing</th>
              <th style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>Extra</th>
              <th style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>Precision</th>
              <th style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>Recall</th>
              <th style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>F1</th>
              <th style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>Score</th>
            </tr>
          </thead>

          <tbody>
            {devs
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((d) => (
                <tr key={d.name}>
                  <td style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}`, fontWeight: 800 }}>
                    {d.name}
                  </td>
                  <td style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>{d.matched}</td>
                  <td style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>{d.missing}</td>
                  <td style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>{d.extra}</td>
                  <td style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>{pct(d.precision)}</td>
                  <td style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}` }}>{pct(d.recall)}</td>
                  <td style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}`, fontWeight: 800 }}>
                    {pct(d.f1)}
                  </td>
                  <td style={{ padding: "14px 12px", borderBottom: `1px solid ${ui.colors.border}`, fontWeight: 900 }}>
                    {d.score}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}