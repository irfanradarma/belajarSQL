import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),

  // Per-connection tuning defaults — every session created via POST /api/connect
  // gets its own single dedicated connection built from the credentials the
  // student supplied (see sessionManager.ts), using these as the timeouts.
  // 120s (raised from 15s, then 60s) because legitimate classroom analytical
  // queries — GROUP BY/HAVING with COUNT(DISTINCT), self-joins — on the
  // shared training instance's larger tables (e.g. a ~180k-row table with no
  // supporting index on the grouped column) can take over a minute on that
  // instance's modest compute/IO. Since each session holds its own dedicated
  // connection (not a shared pool), one slow query only ties up that one
  // student's session. The real fix is indexing the underlying tables; this
  // is a workaround for not administering that database directly.
  DB_REQUEST_TIMEOUT_MS: z.coerce.number().default(120_000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().default(15_000),
  MAX_ROWS_DEFAULT: z.coerce.number().default(5000),
  MAX_ROWS_HARD_CAP: z.coerce.number().default(20_000),

  // A session with no requests for this long has its pool closed and is
  // forgotten — protects against students who wander off leaving a live
  // connection (and a SQL Server login) held open indefinitely. Shortened
  // from 30 minutes: the shared training instance runs SQL Server Express
  // on a db.t3.micro (995MB total RAM, max server memory capped at 725MB),
  // so an idle connection quietly sitting on a slice of that tiny budget for
  // half an hour is a real cost with 60+ concurrent students, not just
  // theoretical waste.
  SESSION_IDLE_TIMEOUT_MS: z.coerce.number().default(10 * 60 * 1000),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
