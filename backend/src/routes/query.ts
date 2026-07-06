import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { QueryStreamFrame } from "@belajarsql/shared";
import { z } from "zod";
import { env } from "../config.js";
import { checkQueryAllowed } from "../lib/sqlGuard.js";
import { executeQueryStreamed } from "../lib/queryStream.js";
import { requireSession } from "../lib/sessionAuth.js";

const executeBodySchema = z.object({
  sql: z.string().min(1).max(20_000),
  maxRows: z.number().int().positive().max(env.MAX_ROWS_HARD_CAP).optional(),
});

export async function queryRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/query/execute", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(req, reply);
    if (!session) return;

    const parsed = executeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Invalid request body.", issues: parsed.error.issues });
    }

    const { sql: sqlText, maxRows } = parsed.data;
    const guard = checkQueryAllowed(sqlText);
    if (!guard.allowed) {
      return reply.status(400).send({ message: guard.reason });
    }

    const effectiveMaxRows = Math.min(maxRows ?? env.MAX_ROWS_DEFAULT, env.MAX_ROWS_HARD_CAP);

    // Manually stream newline-delimited JSON frames so the client can start
    // rendering rows before the query finishes and the row cap can be
    // enforced by simply stopping the stream.
    reply.hijack();

    // reply.hijack() bypasses Fastify's normal response pipeline entirely —
    // including the @fastify/cors plugin's onSend hook that would otherwise
    // add Access-Control-Allow-Origin. Preflight OPTIONS requests are
    // answered by that plugin directly (unaffected by hijacking), but this
    // actual POST response needs the header added by hand, or browsers
    // reject it client-side (curl doesn't enforce CORS, so this was easy to
    // miss when testing with curl instead of a real browser).
    const origin = req.headers.origin;
    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Vary: "Origin",
    };
    if (origin && env.CORS_ALLOWED_ORIGINS.includes(origin)) {
      responseHeaders["Access-Control-Allow-Origin"] = origin;
    }
    reply.raw.writeHead(200, responseHeaders);

    let terminalFrameSent = false;
    const writeFrame = (frame: QueryStreamFrame) => {
      if (frame.type === "done" || frame.type === "error") terminalFrameSent = true;
      reply.raw.write(JSON.stringify(frame) + "\n");
    };

    try {
      await executeQueryStreamed({
        pool: session.pool,
        sqlText,
        maxRows: effectiveMaxRows,
        onFrame: writeFrame,
      });
    } catch (err) {
      req.log.error({ err }, "query execution failed");
      // executeQueryStreamed normally writes an "error" frame itself before
      // rejecting, but a failure before that point (e.g. the pool connection
      // dropped) rejects with no frame written at all — without this
      // fallback the client's stream just ends with no terminal frame,
      // leaving the UI stuck in "running" state forever.
      if (!terminalFrameSent) {
        writeFrame({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      reply.raw.end();
    }
  });
}
