// Single source of truth for the frontend/backend API contract.

export interface ColumnMeta {
  name: string;
  dataType: string;
  isNullable: boolean;
  ordinalPosition: number;
}

export interface TableMeta {
  name: string;
  type: "TABLE" | "VIEW";
  columns: ColumnMeta[];
}

export interface SchemaMeta {
  name: string;
  tables: TableMeta[];
}

export interface SchemaTreeResponse {
  fetchedAt: string;
  schemas: SchemaMeta[];
}

export interface HealthResponse {
  status: "ok";
}

// Students connect like they would in SSMS's Connect dialog — server,
// optional database, username/password — rather than the backend holding
// one fixed shared credential. Each successful connect gets its own
// server-side connection pool, keyed by the returned sessionToken.
export interface ConnectRequest {
  server: string;
  port?: number;
  database?: string;
  username: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}

export interface ConnectResponse {
  sessionToken: string;
  server: string;
  database: string;
  username: string;
}

export interface ApiErrorResponse {
  message: string;
}

export interface ExecuteQueryRequest {
  sql: string;
  maxRows?: number;
}

// Streamed as newline-delimited JSON (NDJSON) over POST /api/query/execute:
//   1. one QueryColumnsFrame
//   2. zero or more QueryRowFrame
//   3. exactly one QueryTrailerFrame (or a QueryErrorFrame on failure)
export interface QueryColumnsFrame {
  type: "columns";
  columns: { name: string; dataType: string }[];
}

export interface QueryRowFrame {
  type: "row";
  row: unknown[];
}

export interface QueryTrailerFrame {
  type: "done";
  rowCount: number;
  truncated: boolean;
  executionMs: number;
}

export interface QueryErrorFrame {
  type: "error";
  message: string;
}

export type QueryStreamFrame =
  | QueryColumnsFrame
  | QueryRowFrame
  | QueryTrailerFrame
  | QueryErrorFrame;

export const DEFAULT_MAX_ROWS = 5000;
