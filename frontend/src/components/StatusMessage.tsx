type Props = {
    title: string;
    message?: string;
    onRetry?: () => void;
  };
  
  export default function StatusMessage({ title, message, onRetry }: Props) {
    return (
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff" }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
        {message ? <div style={{ color: "#666", fontSize: 13 }}>{message}</div> : null}
        {onRetry ? (
          <button
            onClick={onRetry}
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: "pointer",
              background: "#fff",
              fontWeight: 700,
            }}
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }
  