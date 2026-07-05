import type { QueryStreamFrame } from "@belajarsql/shared";
import { sql } from "../db/sessionManager.js";

export interface ExecuteStreamedOptions {
  pool: sql.ConnectionPool;
  sqlText: string;
  maxRows: number;
  onFrame: (frame: QueryStreamFrame) => void;
}

// mssql's column.type is either the type factory function itself (e.g. sql.VarChar)
// or an ISqlType instance produced by calling it (e.g. sql.VarChar(50)) — either way
// the human-readable type name ("VarChar", "Int", ...) lives on a JS Function's
// built-in `.name` property, just at a different nesting depth.
function extractTypeName(type: (() => sql.ISqlType) | sql.ISqlType): string {
  const factory = typeof type === "function" ? type : type.type;
  return (factory as unknown as { name?: string })?.name || "unknown";
}

// Executes a statement in streaming mode and cancels the request once the
// row count exceeds maxRows, rather than trying to rewrite arbitrary SQL to
// inject TOP N (unreliable against CTEs/UNIONs/subqueries). This bounds
// memory/network cost regardless of what the underlying query would return.
export async function executeQueryStreamed({
  pool,
  sqlText,
  maxRows,
  onFrame,
}: ExecuteStreamedOptions): Promise<void> {
  const request = pool.request();
  request.stream = true;

  const startedAt = Date.now();
  let rowCount = 0;
  let truncated = false;
  let columnsSent = false;
  let cancelledByUs = false;
  let settled = false;

  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      if (settled) return;
      settled = true;
      onFrame({
        type: "done",
        rowCount: Math.min(rowCount, maxRows),
        truncated,
        executionMs: Date.now() - startedAt,
      });
      resolve();
    };

    request.on("recordset", (columns: sql.IColumnMetadata) => {
      if (columnsSent) return;
      columnsSent = true;
      onFrame({
        type: "columns",
        columns: Object.values(columns).map((col) => ({
          name: col.name,
          dataType: extractTypeName(col.type),
        })),
      });
    });

    request.on("row", (row: Record<string, unknown>) => {
      rowCount += 1;
      if (rowCount > maxRows) {
        if (!cancelledByUs) {
          truncated = true;
          cancelledByUs = true;
          request.cancel();
        }
        return;
      }
      onFrame({ type: "row", row: Object.values(row) });
    });

    request.on("error", (err: Error & { code?: string }) => {
      // A cancellation we triggered ourselves (row cap reached) is a
      // successful truncation, not a failure — surface it via the normal
      // "done" trailer instead of an error frame.
      if (cancelledByUs && err.code === "ECANCEL") {
        finish();
        return;
      }
      if (settled) return;
      settled = true;
      onFrame({ type: "error", message: err.message });
      reject(err);
    });

    request.on("done", finish);

    request.query(sqlText);
  });
}
