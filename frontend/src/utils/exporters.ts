function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  
  function escapeCsv(value: unknown) {
    const s = String(value ?? "");
    // wrap in quotes if contains comma, quote, or newline
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  
  export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
    if (rows.length === 0) {
      downloadBlob(new Blob([""], { type: "text/csv;charset=utf-8" }), filename);
      return;
    }
  
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(",")),
    ];
  
    downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), filename);
  }
  
  export function exportToHtml(filename: string, title: string, bodyHtml: string) {
    const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>${title}</title>
    <style>
      body{font-family:Arial, sans-serif; padding:24px; color:#111;}
      h1{margin:0 0 8px;}
      p{color:#555;}
      table{border-collapse:collapse; width:100%; margin-top:12px;}
      th,td{border:1px solid #ddd; padding:10px; text-align:left; font-size:14px;}
      th{background:#f7f7f7;}
      .badge{display:inline-block; padding:4px 10px; border-radius:999px; border:1px solid #ddd; font-weight:700; font-size:12px;}
    </style>
  </head>
  <body>
  ${bodyHtml}
  </body>
  </html>`;
  
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), filename);
  }
  