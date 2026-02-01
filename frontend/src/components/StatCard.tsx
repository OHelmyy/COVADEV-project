type StatCardProps = {
    label: string;
    value: string | number;
    hint?: string;
  };
  
  export default function StatCard({ label, value, hint }: StatCardProps) {
    return (
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
          minWidth: 220,
        }}
      >
        <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
        {hint ? (
          <div style={{ fontSize: 12, color: "#777", marginTop: 6 }}>{hint}</div>
        ) : null}
      </div>
    );
  }
  