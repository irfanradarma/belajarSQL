import { create } from "zustand";
import type { SchemaTreeResponse } from "@belajarsql/shared";
import { fetchSchema } from "../api";

interface SchemaState {
  tree: SchemaTreeResponse | null;
  status: "idle" | "loading" | "loaded" | "error";
  error?: string;
  load: () => Promise<void>;
  reset: () => void;
}

// Single source of truth for schema metadata — both the Object Explorer tree
// and Monaco's completion provider (a plain callback, not a component, so it
// reads via useSchemaStore.getState() rather than the hook) need the same
// fetched-once tree.
export const useSchemaStore = create<SchemaState>((set, get) => ({
  tree: null,
  status: "idle",
  load: async () => {
    if (get().status === "loading") return;
    set({ status: "loading", error: undefined });
    try {
      const tree = await fetchSchema();
      set({ tree, status: "loaded" });
    } catch (err) {
      set({ status: "error", error: String(err) });
    }
  },

  // Called on connect/disconnect so a previous connection's schema tree
  // doesn't briefly flash before the new one loads.
  reset: () => set({ tree: null, status: "idle", error: undefined }),
}));
