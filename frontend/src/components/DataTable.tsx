import React from "react";
import { cardBase, ui } from "../theme/ui";

type Column<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
  width?: number | string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
};

export default function DataTable<T>({ columns, rows }: DataTableProps<T>) {
  return (
    <div
      style={{
        ...cardBase,
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ textAlign: "left", background: ui.colors.bgSoft }}>
              {columns.map((c, i) => (
                <th
                  key={i}
                  style={{
                    padding: "14px 14px",
                    borderBottom: `1px solid ${ui.colors.border}`,
                    fontSize: 12,
                    color: ui.colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    width: c.width,
                    fontWeight: 800,
                  }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} style={{ background: "#fff" }}>
                {columns.map((c, i) => (
                  <td
                    key={i}
                    style={{
                      padding: "14px",
                      borderBottom: `1px solid ${ui.colors.border}`,
                      fontSize: 14,
                      color: ui.colors.text,
                      verticalAlign: "top",
                    }}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: 22,
                    color: ui.colors.textMuted,
                    textAlign: "center",
                    fontSize: 14,
                  }}
                >
                  No data yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}