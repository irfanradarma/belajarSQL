import { useEffect, useMemo, useRef, useState } from "react";
import type { SchemaMeta, TableMeta } from "@belajarsql/shared";
import { useSchemaStore } from "../../lib/store/schema";
import { useQueryTabsStore } from "../../lib/store/queryTabs";
import { TableContextMenu } from "./TableContextMenu";

function TableIcon({ type }: { type: TableMeta["type"] }) {
  return (
    <span className="inline-block w-4 text-center text-xs text-fg-muted">
      {type === "VIEW" ? "◇" : "▦"}
    </span>
  );
}

interface TableNodeProps {
  schemaName: string;
  table: TableMeta;
  expanded: boolean;
  onToggle: () => void;
  onContextMenu: (e: React.MouseEvent, schemaName: string, table: TableMeta) => void;
}

function TableNode({ schemaName, table, expanded, onToggle, onContextMenu }: TableNodeProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        onContextMenu={(e) => onContextMenu(e, schemaName, table)}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm hover:bg-accent/10"
        title={`${schemaName}.${table.name}`}
      >
        <span className="w-3 text-xs text-fg-muted">{expanded ? "▾" : "▸"}</span>
        <TableIcon type={table.type} />
        <span className="truncate">{table.name}</span>
      </button>
      {expanded && (
        <ul className="ml-7 border-l border-border pl-2">
          {table.columns.map((col) => (
            <li
              key={col.name}
              className="flex items-baseline gap-2 py-0.5 text-xs text-fg-muted"
              title={`${col.name} (${col.dataType}${col.isNullable ? ", nullable" : ""})`}
            >
              <span className="truncate text-fg">{col.name}</span>
              <span className="shrink-0">{col.dataType}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface SchemaNodeProps {
  schema: SchemaMeta;
  expandedTables: Set<string>;
  onToggleTable: (key: string) => void;
  expandedSchema: boolean;
  onToggleSchema: () => void;
  onContextMenu: (e: React.MouseEvent, schemaName: string, table: TableMeta) => void;
}

function SchemaNode({
  schema,
  expandedTables,
  onToggleTable,
  expandedSchema,
  onToggleSchema,
  onContextMenu,
}: SchemaNodeProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggleSchema}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm font-medium hover:bg-accent/10"
      >
        <span className="w-3 text-xs text-fg-muted">{expandedSchema ? "▾" : "▸"}</span>
        <span className="truncate">{schema.name}</span>
        <span className="ml-auto text-xs font-normal text-fg-muted">{schema.tables.length}</span>
      </button>
      {expandedSchema && (
        <ul className="ml-3">
          {schema.tables.map((table) => {
            const key = `${schema.name}.${table.name}`;
            return (
              <TableNode
                key={key}
                schemaName={schema.name}
                table={table}
                expanded={expandedTables.has(key)}
                onToggle={() => onToggleTable(key)}
                onContextMenu={onContextMenu}
              />
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function ObjectExplorerTree() {
  const status = useSchemaStore((s) => s.status);
  const tree = useSchemaStore((s) => s.tree);
  const error = useSchemaStore((s) => s.error);
  const load = useSchemaStore((s) => s.load);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const autoExpandedOnce = useRef(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    schemaName: string;
    table: TableMeta;
  } | null>(null);
  const addTab = useQueryTabsStore((s) => s.addTab);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // First load: expand every schema by default (there are typically only a
    // handful). Guarded so a later background refresh doesn't re-collapse
    // whatever the student has since toggled shut.
    if (tree && !autoExpandedOnce.current) {
      autoExpandedOnce.current = true;
      setExpandedSchemas(new Set(tree.schemas.map((s) => s.name)));
    }
  }, [tree]);

  const totalTables = useMemo(() => {
    if (!tree) return 0;
    return tree.schemas.reduce((sum, s) => sum + s.tables.length, 0);
  }, [tree]);

  function toggleSchema(name: string) {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleTable(key: string) {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleContextMenu(e: React.MouseEvent, schemaName: string, table: TableMeta) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, schemaName, table });
  }

  function quickSelect(schemaName: string, table: TableMeta, topN: number) {
    const sql = `SELECT TOP ${topN} * FROM [${schemaName}].[${table.name}]`;
    addTab({ title: `${table.name} (Top ${topN})`, initialSql: sql, autoRun: true });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Object Explorer
        </span>
        {tree && <span className="text-xs text-fg-muted">{totalTables} tables</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {(status === "loading" || status === "idle") && (
          <p className="p-2 text-sm text-fg-muted">Loading schema…</p>
        )}
        {status === "error" && (
          <p className="p-2 text-sm text-danger">Failed to load schema: {error}</p>
        )}
        {tree && tree.schemas.length === 0 && (
          <p className="p-2 text-sm text-fg-muted">No tables visible to this connection.</p>
        )}
        {tree && (
          <ul>
            {tree.schemas.map((schema) => (
              <SchemaNode
                key={schema.name}
                schema={schema}
                expandedSchema={expandedSchemas.has(schema.name)}
                onToggleSchema={() => toggleSchema(schema.name)}
                expandedTables={expandedTables}
                onToggleTable={toggleTable}
                onContextMenu={handleContextMenu}
              />
            ))}
          </ul>
        )}
      </div>

      {contextMenu && (
        <TableContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          actions={[
            {
              label: "SELECT TOP 100",
              onSelect: () => quickSelect(contextMenu.schemaName, contextMenu.table, 100),
            },
            {
              label: "SELECT TOP 1000",
              onSelect: () => quickSelect(contextMenu.schemaName, contextMenu.table, 1000),
            },
          ]}
        />
      )}
    </div>
  );
}
