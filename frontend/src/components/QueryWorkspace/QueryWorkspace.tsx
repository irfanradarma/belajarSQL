import { lazy, Suspense, useCallback, useRef, useState } from "react";
import type { QueryStreamFrame } from "@belajarsql/shared";
import { executeQuery } from "../../lib/api";
import { saveQueryAsSql } from "../../lib/saveQuery";
import type { ResultColumn } from "../ResultGrid/VirtualizedResultGrid";
import { ResultPane } from "../ResultGrid/ResultPane";
import type { MonacoQueryEditorHandle } from "../Editor/MonacoQueryEditor";

// Monaco (~2-3MB) is the single largest dependency in this app — code-split
// it into its own chunk rather than the initial bundle so the app shell
// (Object Explorer, layout) paints and becomes interactive first.
const MonacoQueryEditor = lazy(() =>
  import("../Editor/MonacoQueryEditor").then((m) => ({ default: m.MonacoQueryEditor })),
);

type ExecutionState =
  | { status: "idle" }
  | { status: "running"; columns: ResultColumn[]; rows: unknown[][] }
  | {
      status: "done";
      columns: ResultColumn[];
      rows: unknown[][];
      rowCount: number;
      truncated: boolean;
      executionMs: number;
    }
  | { status: "error"; message: string };

const ROW_FLUSH_INTERVAL_MS = 100;

interface QueryWorkspaceProps {
  initialSql?: string;
  autoRun?: boolean;
}

export function QueryWorkspace({ initialSql = "", autoRun = false }: QueryWorkspaceProps) {
  const [sql, setSql] = useState(initialSql);
  const [execution, setExecution] = useState<ExecutionState>({ status: "idle" });
  const runningRef = useRef(false);
  const editorRef = useRef<MonacoQueryEditorHandle>(null);

  // Buffer incoming rows and flush to React state on a timer rather than per
  // row — with a 5,000-row cap a naive setState-per-row would mean
  // thousands of re-renders for one query, which is the opposite of the
  // performance goal streaming was meant to serve.
  const runQuery = useCallback(async (sqlText: string) => {
    if (runningRef.current) return;
    if (!sqlText.trim()) return;
    runningRef.current = true;

    let columns: ResultColumn[] = [];
    let rowBuffer: unknown[][] = [];
    let terminalReceived = false;

    const flush = () => {
      setExecution({ status: "running", columns, rows: [...rowBuffer] });
    };

    setExecution({ status: "running", columns: [], rows: [] });
    const flushTimer = setInterval(flush, ROW_FLUSH_INTERVAL_MS);

    const onFrame = (frame: QueryStreamFrame) => {
      switch (frame.type) {
        case "columns":
          columns = frame.columns;
          break;
        case "row":
          rowBuffer.push(frame.row);
          break;
        case "done":
          terminalReceived = true;
          setExecution({
            status: "done",
            columns,
            rows: rowBuffer,
            rowCount: frame.rowCount,
            truncated: frame.truncated,
            executionMs: frame.executionMs,
          });
          break;
        case "error":
          terminalReceived = true;
          setExecution({ status: "error", message: frame.message });
          break;
      }
    };

    try {
      await executeQuery({ sql: sqlText }, onFrame);
      // Guards against a stream that ends (server crash, network drop) without
      // ever sending a "done"/"error" frame — without this the UI would be
      // stuck showing "Running…" forever with no way to recover.
      if (!terminalReceived) {
        setExecution({ status: "error", message: "Connection closed before the query finished." });
      }
    } catch (err) {
      setExecution({ status: "error", message: String(err) });
    } finally {
      clearInterval(flushTimer);
      runningRef.current = false;
    }
  }, []);

  // "Run Statement" — the button and Ctrl+Enter both execute just the
  // selection (if any) or the statement chunk under the cursor, not the
  // whole editor, so students can iterate on one query in a multi-query
  // scratchpad without accidentally re-running everything above it.
  const handleRunStatement = useCallback(
    (chunkSql?: string) => {
      const target = chunkSql ?? editorRef.current?.getRunTarget() ?? "";
      void runQuery(target);
    },
    [runQuery],
  );

  const handleRunAll = useCallback(() => {
    void runQuery(sql);
  }, [runQuery, sql]);

  // autoRun fires once when a workspace is created pre-filled (e.g. the
  // Object Explorer's "SELECT TOP 100" quick action from M6).
  const autoRunFired = useRef(false);
  if (autoRun && !autoRunFired.current && initialSql) {
    autoRunFired.current = true;
    queueMicrotask(() => void runQuery(initialSql));
  }

  const isRunning = execution.status === "running";
  const displayColumns =
    execution.status === "running" || execution.status === "done" ? execution.columns : [];
  const displayRows =
    execution.status === "running" || execution.status === "done" ? execution.rows : [];
  const rowCount = execution.status === "done" ? execution.rowCount : null;
  const truncated = execution.status === "done" && execution.truncated;
  const executionMs = execution.status === "done" ? execution.executionMs : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <button
          type="button"
          onClick={() => handleRunStatement()}
          disabled={isRunning}
          className="rounded bg-accent px-3 py-1 text-xs font-medium text-accent-fg disabled:opacity-50"
          title="Run the selected text, or the statement under the cursor"
        >
          {isRunning ? "Running…" : "Run Statement (Ctrl+Enter)"}
        </button>
        <button
          type="button"
          onClick={handleRunAll}
          disabled={isRunning}
          className="rounded border border-border px-3 py-1 text-xs font-medium text-fg hover:bg-accent/10 disabled:opacity-50"
          title="Run the entire editor contents"
        >
          Run All (Ctrl+Shift+Enter)
        </button>
        <button
          type="button"
          onClick={() => saveQueryAsSql(sql)}
          disabled={!sql.trim()}
          className="ml-auto rounded border border-border px-2 py-1 text-xs text-fg-muted hover:bg-accent/10 disabled:opacity-40"
          title="Save this query to a .sql file"
        >
          Save as .sql
        </button>
      </div>

      <div className="h-[45%] min-h-[160px] border-b border-border">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-fg-muted">
              Loading editor…
            </div>
          }
        >
          <MonacoQueryEditor
            ref={editorRef}
            value={sql}
            onChange={setSql}
            onRunStatement={handleRunStatement}
            onRunAll={handleRunAll}
          />
        </Suspense>
      </div>

      <div className="min-h-0 flex-1">
        {execution.status === "error" ? (
          <div className="p-3 text-sm text-danger">{execution.message}</div>
        ) : (
          <ResultPane
            columns={displayColumns}
            rows={displayRows}
            isRunning={isRunning}
            rowCount={rowCount}
            truncated={truncated}
            executionMs={executionMs}
          />
        )}
      </div>
    </div>
  );
}
