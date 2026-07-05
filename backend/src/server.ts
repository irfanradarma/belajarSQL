import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { schemaRoutes } from "./routes/schema.js";
import { queryRoutes } from "./routes/query.js";
import { connectRoutes } from "./routes/connect.js";
import { startIdleSessionSweep } from "./db/sessionManager.js";

const app = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    // Students' DB passwords and session tokens must never land in logs.
    redact: {
      paths: ["req.body.password", "req.headers['x-session-token']"],
      censor: "[redacted]",
    },
  },
});

await app.register(cors, {
  origin: env.CORS_ALLOWED_ORIGINS,
});

// Generous default limit; connect/query get stricter overrides below since
// they're the routes that actually touch a real SQL Server login.
await app.register(rateLimit, {
  global: true,
  max: 120,
  timeWindow: "1 minute",
});

await app.register(healthRoutes);
await app.register(schemaRoutes);
await app.register(async (instance) => {
  await instance.register(rateLimit, {
    max: 20,
    timeWindow: "1 minute",
  });
  await instance.register(queryRoutes);
});
await app.register(async (instance) => {
  await instance.register(rateLimit, {
    // Stricter still — this is the route that opens a real DB connection
    // per attempt, so it's the one most worth throttling against brute
    // forcing or accidental hammering.
    max: 10,
    timeWindow: "1 minute",
  });
  await instance.register(connectRoutes);
});

const start = async () => {
  startIdleSessionSweep();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
};

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
