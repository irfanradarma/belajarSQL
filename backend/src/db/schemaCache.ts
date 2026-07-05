import type { ColumnMeta, SchemaMeta, SchemaTreeResponse, TableMeta } from "@belajarsql/shared";
import type { Session } from "./sessionManager.js";

interface RawRow {
  schemaName: string;
  tableName: string;
  tableType: string;
  columnName: string;
  dataType: string;
  isNullable: boolean;
  ordinalPosition: number;
}

const METADATA_QUERY = `
SELECT
  s.name        AS schemaName,
  t.name        AS tableName,
  t.type_desc   AS tableType,
  c.name        AS columnName,
  ty.name       AS dataType,
  c.is_nullable AS isNullable,
  c.column_id   AS ordinalPosition
FROM sys.columns c
JOIN sys.objects t ON t.object_id = c.object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.type IN ('U', 'V') -- user tables and views only
ORDER BY s.name, t.name, c.column_id;
`;

function buildTree(rows: RawRow[]): SchemaTreeResponse {
  const schemaMap = new Map<string, Map<string, TableMeta>>();

  for (const row of rows) {
    let tableMap = schemaMap.get(row.schemaName);
    if (!tableMap) {
      tableMap = new Map();
      schemaMap.set(row.schemaName, tableMap);
    }

    const tableKey = row.tableName;
    let table = tableMap.get(tableKey);
    if (!table) {
      table = {
        name: row.tableName,
        type: row.tableType === "VIEW" ? "VIEW" : "TABLE",
        columns: [],
      };
      tableMap.set(tableKey, table);
    }

    const column: ColumnMeta = {
      name: row.columnName,
      dataType: row.dataType,
      isNullable: row.isNullable,
      ordinalPosition: row.ordinalPosition,
    };
    table.columns.push(column);
  }

  const schemas: SchemaMeta[] = Array.from(schemaMap.entries()).map(([name, tables]) => ({
    name,
    tables: Array.from(tables.values()),
  }));

  return { fetchedAt: new Date().toISOString(), schemas };
}

async function fetchMetadata(session: Session): Promise<SchemaTreeResponse> {
  const result = await session.pool.request().query<RawRow>(METADATA_QUERY);
  return buildTree(result.recordset);
}

// Cache lives on the session itself (see db/sessionManager.ts) since each
// session can point at an entirely different server/database — there is no
// longer one global cache to share across everyone.
export async function refreshSchemaForSession(session: Session): Promise<SchemaTreeResponse> {
  if (!session.schemaInFlight) {
    session.schemaInFlight = fetchMetadata(session)
      .then((tree) => {
        session.schemaCache = tree;
        return tree;
      })
      .finally(() => {
        session.schemaInFlight = null;
      });
  }
  return session.schemaInFlight;
}

export async function getSchemaForSession(session: Session): Promise<SchemaTreeResponse> {
  if (session.schemaCache) return session.schemaCache;
  return refreshSchemaForSession(session);
}
