export function exportToCSV(
  columns: Array<{ id: string; header: string }>,
  rows: Record<string, unknown>[],
  filename: string = "query-results.csv"
) {
  if (!columns.length || !rows.length) {
    throw new Error("No data to export");
  }

  // Create CSV header
  const headers = columns.map((col) => escapeCSVValue(col.header)).join(",");

  // Create CSV rows
  const csvRows = rows.map((row) => {
    return columns
      .map((col) => {
        const value = row[col.id];
        return escapeCSVValue(String(value ?? ""));
      })
      .join(",");
  });

  // Combine header and rows
  const csv = [headers, ...csvRows].join("\n");

  // Create blob and download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCSVValue(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
