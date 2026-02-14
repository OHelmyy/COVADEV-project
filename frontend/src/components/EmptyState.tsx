type Props = {
    title: string;
    description?: string;
  };
  
  export default function EmptyState({ title, description }: Props) {
    return (
      <div
        style={{
          border: "1px dashed #ddd",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
          color: "#555",
        }}
      >
        <div style={{ fontWeight: 900 }}>{title}</div>
        {description ? <div style={{ marginTop: 6, fontSize: 13, color: "#777" }}>{description}</div> : null}
      </div>
    );
  }
  