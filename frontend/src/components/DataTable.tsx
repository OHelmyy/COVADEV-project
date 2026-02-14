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
      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {columns.map((c, i) => (
                <th
                  key={i}
                  style={{
                    padding: "12px 10px",
                    borderBottom: "1px solid #eee",
                    fontSize: 13,
                    color: "#444",
                    width: c.width,
                  }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
  
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                {columns.map((c, i) => (
                  <td key={i} style={{ padding: "12px 10px", borderBottom: "1px solid #f3f3f3", fontSize: 14 }}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 16, color: "#777" }}>
                  No data yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }
  