import { ExportButtons } from "./ExportButtons";
import { VirtualizedResultGrid, type ResultColumn } from "./VirtualizedResultGrid";

interface ResultPaneProps {
  columns: ResultColumn[];
  rows: unknown[][];
  isRunning: boolean;
  rowCount: number | null;
  truncated: boolean;
  executionMs: number | null;
}

export function ResultPane({
  columns,
  rows,
  isRunning,
  rowCount,
  truncated,
  executionMs,
}: ResultPaneProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-1">
        <span className="text-xs text-fg-muted">
          {isRunning && `Streaming rows: ${rows.length}…`}
          {!isRunning && rowCount !== null && (
            <>
              {rowCount} row{rowCount === 1 ? "" : "s"}
              {truncated ? " (truncated at cap)" : ""}
              {executionMs !== null ? ` · ${executionMs}ms` : ""}
            </>
          )}
        </span>
        <ExportButtons columns={columns} rows={rows} />
      </div>
      <div className="min-h-0 flex-1">
        <VirtualizedResultGrid columns={columns} rows={rows} />
      </div>
    </div>
  );
}
