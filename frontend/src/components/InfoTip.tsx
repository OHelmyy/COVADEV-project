import { useState } from "react";
import { ui } from "../theme/ui";

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
          width: 20,
          height: 20,
          borderRadius: 999,
          border: `1px solid ${ui.colors.borderStrong}`,
          background: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 900,
          color: ui.colors.primary,
          cursor: "help",
          userSelect: "none",
          boxShadow: ui.shadow.sm,
        }}
      >
        i
      </span>

      {open ? (
        <span
          style={{
            position: "absolute",
            top: 28,
            left: 0,
            zIndex: 20,
            width: 280,
            background: ui.colors.bgDark,
            color: "#fff",
            padding: "12px 14px",
            borderRadius: 14,
            fontSize: 12,
            lineHeight: 1.6,
            boxShadow: ui.shadow.md,
          }}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}