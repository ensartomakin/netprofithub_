export type CsvValue = string | number | boolean | null | undefined;

function escapeCell(value: CsvValue) {
  if (value == null) return "";
  const s = String(value);
  // If contains comma, quote, newline -> wrap and escape quotes
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T extends Record<string, CsvValue>>(
  rows: T[],
  columns?: Array<keyof T>
) {
  const cols = (columns ?? (rows[0] ? (Object.keys(rows[0]) as Array<keyof T>) : [])) as Array<
    keyof T
  >;
  const header = cols.map((c) => escapeCell(String(c))).join(",");
  const body = rows
    .map((r) => cols.map((c) => escapeCell(r[c])).join(","))
    .join("\n");
  return [header, body].filter(Boolean).join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

