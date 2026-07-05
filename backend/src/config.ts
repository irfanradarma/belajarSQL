import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),

  // Per-connection pool defaults — every session created via POST /api/connect
  // gets its own pool built from the credentials the student supplied, using
  // these as the tuning defaults (not a single fixed DB connection anymore).
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_REQUEST_TIMEOUT_MS: z.coerce.number().default(15_000),
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
