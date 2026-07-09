import crypto from "node:crypto";
import sql from "mssql";
import type { SchemaTreeResponse } from "@belajarsql/shared";
import { env } from "../config.js";

export interface ConnectParams {
  server: string;
  port?: number;
  database?: string;
  username: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}

export interface Session {
  id: string;
  pool: sql.ConnectionPool;
  server: string;
  database: string;
  username: string;
  createdAt: number;
  lastUsedAt: number;
  schemaCache: SchemaTreeResponse | null;
  schemaInFlight: Promise<SchemaTreeResponse> | null;
}

// Every successful POST /api/connect gets its own pool, keyed by a random
// session token the frontend sends back on every subsequent request (see
// lib/sessionAuth.ts) — replaces the old single boot-time pool now that
// students bring their own server/credentials rather than sharing one.
const sessions = new Map<string, Session>();

export async function createSession(params: ConnectParams): Promise<Session> {
  const config: sql.config = {
    server: params.server,
    port: params.port ?? 1433,
    database: params.database,
    user: params.username,
    password: params.password,
    options: {
      encrypt: params.encrypt ?? true,
      trustServerCertificate: params.trustServerCertificate ?? false,
    },
    // Pinned to a single physical connection rather than a real pool. Local
    // temp tables (#name) are scoped by SQL Server to the connection/SPID
    // that created them — with more than one connection in play, queries
    // could land on different SPIDs and temp tables would randomly appear
    // to vanish. Pinning to one connection also means a student's temp
    // tables are guaranteed invisible to every other session, even one
    // using the same SQL login from a different computer.
    pool: {
      max: 1,
      min: 1,
      idleTimeoutMillis: 30_000,
    },
    requestTimeout: env.DB_REQUEST_TIMEOUT_MS,
    connectionTimeout: env.DB_CONNECTION_TIMEOUT_MS,
  };

  const pool = await new sql.ConnectionPool(config).connect();

  // Resolve the actual database the login landed in — relevant when the
  // student left "database" blank and SQL Server picked their default.
  let resolvedDatabase = params.database ?? "";
  try {
    const result = await pool.request().query<{ dbName: string }>("SELECT DB_NAME() AS dbName");
    resolvedDatabase = result.recordset[0]?.dbName ?? resolvedDatabase;
  } catch {
    // Non-fatal — fall back to whatever the student typed (or blank).
  }

  const id = crypto.randomUUID();
  const session: Session = {
    id,
    pool,
    server: params.server,
    database: resolvedDatabase,
    username: params.username,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    schemaCache: null,
    schemaInFlight: null,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(token: string): Session | undefined {
  const session = sessions.get(token);
  if (session) session.lastUsedAt = Date.now();
  return session;
}

export async function closeSession(token: string): Promise<void> {
  const session = sessions.get(token);
  if (!session) return;
  sessions.delete(token);
  try {
    await session.pool.close();
  } catch {
    // Already closed / connection already dead — nothing further to do.
  }
}

export function startIdleSessionSweep(): void {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions) {
      if (now - session.lastUsedAt > env.SESSION_IDLE_TIMEOUT_MS) {
        void closeSession(token);
      }
    }
  }, 60_000);
  timer.unref?.();
}

export { sql };
