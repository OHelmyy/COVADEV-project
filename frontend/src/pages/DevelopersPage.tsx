type DevScore = {
  name: string;
  matched: number;
  missing: number;
  extra: number;
  precision: number; // 0..1
  recall: number;    // 0..1
  f1: number;        // 0..1
  score: number;     // 0..100
};

function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

export default function DevelopersPage() {
  // ✅ Mock data (later comes from backend)
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0 }}>Developers</h1>
        <p style={{ marginTop: 6, color: "#555" }}>
          Developer comparison (mock evaluation results).
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff", minWidth: 260 }}>
          <div style={{ fontSize: 13, color: "#555" }}>Top Performer</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{top.name}</div>
          <div style={{ fontSize: 13, color: "#777", marginTop: 6 }}>Score: {top.score}/100</div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff", minWidth: 260 }}>
          <div style={{ fontSize: 13, color: "#555" }}>Average F1</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{pct(avgF1)}</div>
          <div style={{ fontSize: 13, color: "#777", marginTop: 6 }}>Across all developers</div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff", minWidth: 260 }}>
          <div style={{ fontSize: 13, color: "#555" }}>Total Tasks (Matched + Missing)</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{totalTasks}</div>
          <div style={{ fontSize: 13, color: "#777", marginTop: 6 }}>BPMN workload overview</div>
        </div>
      </div>

      {/* Simple bar chart */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff" }}>
        <h2 style={{ marginTop: 0 }}>Overall Score</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {devs
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((d) => (
              <div key={d.name} style={{ display: "grid", gridTemplateColumns: "120px 1fr 60px", gap: 12, alignItems: "center" }}>
                <div style={{ fontWeight: 800 }}>{d.name}</div>
                <div style={{ height: 12, borderRadius: 999, background: "#f2f2f2", overflow: "hidden" }}>
                  <div style={{ width: `${(d.score / maxScore) * 100}%`, height: "100%", background: "#094780" }} />
                </div>
                <div style={{ fontWeight: 800, textAlign: "right" }}>{d.score}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "12px 10px", borderBottom: "1px solid #eee" }}>Developer</th>
              <th style={{ padding: "12px 10px", borderBottom: "1px solid #eee" }}>Matched</th>
              <th style={{ padding: "12px 10px", borderBottom: "1px solid #eee" }}>Missing</th>
              <th style={{ padding: "12px 10px", borderBottom: "1px solid #eee" }}>Extra</th>
              <th style={{ padding: "12px 10px", borderBottom: "1px solid #eee" }}>Precision</th>
              <th style={{ padding: "12px 10px", borderBottom: "1px solid #eee" }}>Recall</th>
              <th style={{ padding: "12px 10px", borderBottom: "1px solid #eee" }}>F1</th>
              <th style={{ padding: "12px 10px", borderBottom: "1px solid #eee" }}>Score</th>
            </tr>
          </thead>

          <tbody>
            {devs
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((d) => (
                <tr key={d.name}>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #f3f3f3", fontWeight: 800 }}>{d.name}</td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #f3f3f3" }}>{d.matched}</td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #f3f3f3" }}>{d.missing}</td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #f3f3f3" }}>{d.extra}</td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #f3f3f3" }}>{pct(d.precision)}</td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #f3f3f3" }}>{pct(d.recall)}</td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #f3f3f3", fontWeight: 800 }}>{pct(d.f1)}</td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #f3f3f3", fontWeight: 900 }}>{d.score}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
