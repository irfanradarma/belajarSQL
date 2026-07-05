import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ConnectResponse } from "@belajarsql/shared";
import { z } from "zod";
import { closeSession, createSession } from "../db/sessionManager.js";
import { requireSession } from "../lib/sessionAuth.js";

const connectBodySchema = z.object({
  server: z.string().min(1),
  port: z.coerce.number().int().positive().optional(),
  database: z.string().trim().min(1).optional(),
  username: z.string().min(1),
  password: z.string().min(1),
  encrypt: z.boolean().optional(),
  trustServerCertificate: z.boolean().optional(),
});

export async function connectRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/connect", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = connectBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Invalid connection details." });
    }

    try {
      const session = await createSession(parsed.data);
      const body: ConnectResponse = {
        sessionToken: session.id,
        server: session.server,
        database: session.database,
        username: session.username,
      };
      return reply.send(body);
    } catch (err) {
      req.log.warn({ err, server: parsed.data.server }, "connect attempt failed");
      const message = err instanceof Error ? err.message : "Failed to connect to the database.";
      // 400, not 401 — a failed login attempt is a bad request, distinct
      // from the 401 protected routes use to mean "no/expired session",
      // which the frontend treats very differently (auto-redirect to the
      // connect page rather than displaying an inline form error).
      return reply.status(400).send({ message });
    }
  });

  app.post("/api/disconnect", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(req, reply);
    if (!session) return;
    await closeSession(session.id);
    return reply.send({ ok: true });
  });
}
