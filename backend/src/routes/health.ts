import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "@belajarsql/shared";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async (): Promise<HealthResponse> => {
    return { status: "ok" };
  });
}
