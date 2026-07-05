import type { ResultColumn } from "./VirtualizedResultGrid";

interface ExportButtonsProps {
  columns: ResultColumn[];
  rows: unknown[][];
  baseFilename?: string;
}

// SheetJS is a substantial dependency that only matters once a student
// actually asks to export — dynamically imported here rather than at module
// load so it never sits in the initial bundle alongside the app shell.
async function handleExport(
  kind: "csv" | "xlsx",
  columns: ResultColumn[],
  rows: unknown[][],
  baseFilename: string,
) {
  const { exportToCsv, exportToXlsx } = await import("../../lib/export");
  if (kind === "csv") exportToCsv(columns, rows, `${baseFilename}.csv`);
  else exportToXlsx(columns, rows, `${baseFilename}.xlsx`);
}

export function ExportButtons({ columns, rows, baseFilename = "results" }: ExportButtonsProps) {
  const disabled = columns.length === 0 || rows.length === 0;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => void handleExport("csv", columns, rows, baseFilename)}
        className="rounded border border-border px-2 py-1 text-xs text-fg-muted hover:bg-accent/10 disabled:opacity-40"
        title="Export visible results to CSV"
      >
        Export CSV
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void handleExport("xlsx", columns, rows, baseFilename)}
        className="rounded border border-border px-2 py-1 text-xs text-fg-muted hover:bg-accent/10 disabled:opacity-40"
        title="Export visible results to Excel"
      >
        Export XLSX
      </button>
    </div>
  );
}
