import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getSchemaForSession, refreshSchemaForSession } from "../db/schemaCache.js";
import { requireSession } from "../lib/sessionAuth.js";

export async function schemaRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/schema", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(req, reply);
    if (!session) return;
    const tree = await getSchemaForSession(session);
    return reply.send(tree);
  });

  app.post("/api/schema/refresh", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(req, reply);
    if (!session) return;
    const tree = await refreshSchemaForSession(session);
    return reply.send({ fetchedAt: tree.fetchedAt });
  });
}
