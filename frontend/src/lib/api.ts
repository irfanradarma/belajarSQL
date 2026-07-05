import type {
  ApiErrorResponse,
  ConnectRequest,
  ConnectResponse,
  ExecuteQueryRequest,
  HealthResponse,
  QueryStreamFrame,
  SchemaTreeResponse,
} from "@belajarsql/shared";

// In production this is injected at build time (see .github/workflows/deploy-frontend.yml)
// to point at the deployed Render backend. In local dev it's left unset and
// Vite's dev-server proxy (vite.config.ts) forwards /api to localhost:4000.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const SESSION_HEADER = "X-Session-Token";

// Set by the connection store (lib/store/connection.ts) rather than imported
// directly here, to avoid a circular import between the store and this module.
let sessionToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

function authHeaders(): Record<string, string> {
  return sessionToken ? { [SESSION_HEADER]: sessionToken } : {};
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorResponse;
    if (body?.message) return body.message;
  } catch {
    // Body wasn't JSON — fall through to a generic message.
  }
  return `${res.status} ${res.statusText}`;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  // A 401 here always means "no/expired session" (login failures on
  // /api/connect itself use 400, so they never trigger this).
  if (res.status === 401) onUnauthorized?.();
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await apiFetch("/api/health");
  return res.json();
}

export async function connectToDatabase(request: ConnectRequest): Promise<ConnectResponse> {
  const res = await apiFetch("/api/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return res.json();
}

export async function disconnectSession(): Promise<void> {
  await apiFetch("/api/disconnect", { method: "POST" });
}

export async function fetchSchema(): Promise<SchemaTreeResponse> {
  const res = await apiFetch("/api/schema");
  return res.json();
}

// Executes a query against the streamed NDJSON endpoint, invoking onFrame as
// each line arrives so the caller can render rows incrementally rather than
// waiting for the whole result set.
export async function executeQuery(
  request: ExecuteQueryRequest,
  onFrame: (frame: QueryStreamFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/query/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(request),
    signal,
  });

  if (res.status === 401) onUnauthorized?.();
  if (!res.ok || !res.body) {
    throw new Error(await parseErrorMessage(res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.trim()) onFrame(JSON.parse(line) as QueryStreamFrame);
    }
  }

  if (buffer.trim()) onFrame(JSON.parse(buffer) as QueryStreamFrame);
}
