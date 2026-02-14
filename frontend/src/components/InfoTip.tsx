import { useState } from "react";

type Props = {
  text: string;
};

export default function InfoTip({ text }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          border: "1px solid #ddd",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 900,
          color: "#555",
          cursor: "help",
          userSelect: "none",
        }}
      >
        i
      </span>

      {open ? (
        <span
          style={{
            position: "absolute",
            top: 24,
            left: 0,
            zIndex: 10,
            width: 260,
            background: "#111",
            color: "#fff",
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 12,
            lineHeight: 1.4,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
