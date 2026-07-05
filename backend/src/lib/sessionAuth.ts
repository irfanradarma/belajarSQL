import type { FastifyReply, FastifyRequest } from "fastify";
import { getSession, type Session } from "../db/sessionManager.js";

export const SESSION_HEADER = "x-session-token";

// Looks up the session for the request's X-Session-Token header, writing a
// 401 and returning null if it's missing or points at a session that no
// longer exists (never connected, disconnected, or swept for being idle).
export function requireSession(req: FastifyRequest, reply: FastifyReply): Session | null {
  const token = req.headers[SESSION_HEADER];
  if (typeof token !== "string" || !token) {
    reply.status(401).send({ message: "Not connected. Please connect to a database first." });
    return null;
  }
  const session = getSession(token);
  if (!session) {
    reply.status(401).send({ message: "Session expired or not found. Please reconnect." });
    return null;
  }
  return session;
}
