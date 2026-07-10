import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),

  // Per-connection tuning defaults — every session created via POST /api/connect
  // gets its own single dedicated connection built from the credentials the
  // student supplied (see sessionManager.ts), using these as the timeouts.
  // 60s (not the tighter 15s this started at) because legitimate classroom
  // analytical queries — GROUP BY/HAVING with COUNT(DISTINCT), self-joins —
  // routinely take longer than 15s on a shared, modest-spec training
  // instance; since each session holds its own dedicated connection (not a
  // shared pool), one slow query only ties up that one student's session.
  DB_REQUEST_TIMEOUT_MS: z.coerce.number().default(60_000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().default(15_000),
  MAX_ROWS_DEFAULT: z.coerce.number().default(5000),
  MAX_ROWS_HARD_CAP: z.coerce.number().default(20_000),

  // A session with no requests for this long has its pool closed and is
  // forgotten — protects against students who wander off leaving a live
  // connection (and a SQL Server login) held open indefinitely.
  SESSION_IDLE_TIMEOUT_MS: z.coerce.number().default(30 * 60 * 1000),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
