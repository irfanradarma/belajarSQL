import { create } from "zustand";
import type { ConnectRequest } from "@belajarsql/shared";
import { connectToDatabase, disconnectSession, setSessionToken, setUnauthorizedHandler } from "../api";
import { useSchemaStore } from "./schema";
import { useQueryTabsStore } from "./queryTabs";

const REMEMBERED_KEY = "belajarsql.lastConnection";

// Convenience only — never includes the password, so a remembered entry
// still requires re-typing the password to actually reconnect.
interface RememberedConnection {
  server: string;
  port?: number;
  database?: string;
  username: string;
}

function loadRemembered(): RememberedConnection | null {
  try {
    const raw = localStorage.getItem(REMEMBERED_KEY);
    return raw ? (JSON.parse(raw) as RememberedConnection) : null;
  } catch {
    return null;
  }
}

function saveRemembered(conn: RememberedConnection): void {
  try {
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(conn));
  } catch {
    // localStorage unavailable (private browsing, quota) — not fatal.
  }
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface ConnectionState {
  status: ConnectionStatus;
  sessionToken: string | null;
  server: string | null;
  database: string | null;
  username: string | null;
  error?: string;
  remembered: RememberedConnection | null;
  connect: (request: ConnectRequest) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "disconnected",
  sessionToken: null,
  server: null,
  database: null,
  username: null,
  error: undefined,
  remembered: loadRemembered(),

  connect: async (request) => {
    set({ status: "connecting", error: undefined });
    try {
      const res = await connectToDatabase(request);
      setSessionToken(res.sessionToken);
      set({
        status: "connected",
        sessionToken: res.sessionToken,
        server: res.server,
        database: res.database,
        username: res.username,
      });
      useSchemaStore.getState().reset();
      useQueryTabsStore.getState().resetTabs();
      saveRemembered({
        server: request.server,
        port: request.port,
        database: request.database,
        username: request.username,
      });
    } catch (err) {
      set({ status: "error", error: String(err) });
    }
  },

  disconnect: async () => {
    try {
      await disconnectSession();
    } catch {
      // Best-effort — the backend will also reap this session once it goes
      // idle, so a failed disconnect call still leaves things safe.
    } finally {
      setSessionToken(null);
      set({
        status: "disconnected",
        sessionToken: null,
        server: null,
        database: null,
        username: null,
        error: undefined,
      });
    }
  },
}));

// Any 401 from a protected route means the session is gone (idle timeout,
// server restart, etc.) — drop back to "disconnected" with an explanatory
// message rather than leaving the UI stuck showing stale, now-broken state.
setUnauthorizedHandler(() => {
  setSessionToken(null);
  useConnectionStore.setState({
    status: "error",
    sessionToken: null,
    error: "Session expired. Please reconnect.",
  });
});
