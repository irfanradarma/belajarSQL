import { useMemo, useRef } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface ResultColumn {
  name: string;
  dataType: string;
}

interface RowRecord {
  values: unknown[];
}

interface VirtualizedResultGridProps {
  columns: ResultColumn[];
  rows: unknown[][];
}

const NUMERIC_TYPES = new Set([
  "Int", "BigInt", "SmallInt", "TinyInt", "Decimal", "Numeric", "Float",
  "Real", "Money", "SmallMoney",
]);

const DEFAULT_COLUMN_WIDTH = 160;
const MIN_COLUMN_WIDTH = 60;

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function VirtualizedResultGrid({ columns, rows }: VirtualizedResultGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const tableColumns = useMemo(() => {
    const helper = createColumnHelper<RowRecord>();
    return columns.map((col, idx) =>
      helper.accessor((row) => row.values[idx], {
        id: `col-${idx}`,
        header: () => col.name,
        cell: (info) => formatCellValue(info.getValue()),
        meta: { dataType: col.dataType },
        size: DEFAULT_COLUMN_WIDTH,
        minSize: MIN_COLUMN_WIDTH,
      }),
    );
  }, [columns]);

  const data = useMemo<RowRecord[]>(() => rows.map((values) => ({ values })), [rows]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const tableRows = table.getRowModel().rows;
  const leafColumns = table.getAllLeafColumns();

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 12,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalHeight - virtualItems[virtualItems.length - 1].end : 0;

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-fg-muted">
        Run a query to see results.
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto border border-border">
      <table
        className="border-collapse text-sm"
        style={{ width: table.getTotalSize(), tableLayout: "fixed" }}
      >
        <colgroup>
          {leafColumns.map((column) => (
            <col key={column.id} style={{ width: column.getSize() }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-surface">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="relative overflow-hidden text-ellipsis whitespace-nowrap border border-border px-3 py-1.5 text-left font-medium text-fg-muted"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-accent ${
                      header.column.getIsResizing() ? "bg-accent" : ""
                    }`}
                  />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden>
              <td style={{ height: paddingTop }} colSpan={columns.length} />
            </tr>
          )}
          {virtualItems.map((virtualItem) => {
            const row = tableRows[virtualItem.index];
            return (
              <tr key={row.id} className="odd:bg-surface/40 hover:bg-accent/10">
                {row.getVisibleCells().map((cell) => {
                  const dataType = (cell.column.columnDef.meta as { dataType?: string } | undefined)
                    ?.dataType;
                  const rawValue = cell.getValue();
                  const isNull = rawValue === null || rawValue === undefined;
                  const isNumeric = dataType ? NUMERIC_TYPES.has(dataType) : false;
                  return (
                    <td
                      key={cell.id}
                      title={isNull ? "NULL" : String(rawValue)}
                      className={`overflow-hidden text-ellipsis whitespace-nowrap border border-border px-3 py-1 ${isNumeric ? "text-right tabular-nums" : "text-left"} ${
                        isNull ? "italic text-fg-muted" : "text-fg"
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden>
              <td style={{ height: paddingBottom }} colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
