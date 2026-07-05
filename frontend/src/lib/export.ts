import * as XLSX from "xlsx";
import type { ResultColumn } from "../components/ResultGrid/VirtualizedResultGrid";

// Exports operate purely on the result set already loaded in the grid — no
// extra API call, no re-querying the shared read-only connection. This keeps
// export instant and off the DB entirely, regardless of the row cap applied
// when the query ran.
function toAoa(columns: ResultColumn[], rows: unknown[][]): unknown[][] {
  const header = columns.map((c) => c.name);
  const body = rows.map((row) => row.map((value) => value ?? ""));
  return [header, ...body];
}

export function exportToXlsx(
  columns: ResultColumn[],
  rows: unknown[][],
  filename = "results.xlsx",
): void {
  const worksheet = XLSX.utils.aoa_to_sheet(toAoa(columns, rows));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
  XLSX.writeFile(workbook, filename);
}

export function exportToCsv(
  columns: ResultColumn[],
  rows: unknown[][],
  filename = "results.csv",
): void {
  const worksheet = XLSX.utils.aoa_to_sheet(toAoa(columns, rows));
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
