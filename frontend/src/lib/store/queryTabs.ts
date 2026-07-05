import { create } from "zustand";

export interface QueryTab {
  id: string;
  title: string;
  // Seed value only — once mounted, QueryWorkspace/Monaco own the live
  // content internally. Tabs stay mounted (just visually hidden) when
  // inactive specifically so that live content and results aren't lost.
  initialSql: string;
  autoRun?: boolean;
}

interface QueryTabsState {
  tabs: QueryTab[];
  activeTabId: string;
  addTab: (opts?: { title?: string; initialSql?: string; autoRun?: boolean }) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  resetTabs: () => void;
}

function nextDefaultTitle(existing: QueryTab[]): string {
  const numbers = existing
    .map((t) => /^SQLQuery(\d+)\.sql$/.exec(t.title)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number);
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `SQLQuery${next}.sql`;
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useQueryTabsStore = create<QueryTabsState>((set, get) => {
  const firstTab: QueryTab = { id: makeId(), title: "SQLQuery1.sql", initialSql: "" };

  return {
    tabs: [firstTab],
    activeTabId: firstTab.id,

    addTab: (opts) => {
      const { tabs } = get();
      const id = makeId();
      const tab: QueryTab = {
        id,
        title: opts?.title ?? nextDefaultTitle(tabs),
        initialSql: opts?.initialSql ?? "",
        autoRun: opts?.autoRun,
      };
      set({ tabs: [...tabs, tab], activeTabId: id });
      return id;
    },

    closeTab: (id) => {
      const { tabs, activeTabId } = get();
      const index = tabs.findIndex((t) => t.id === id);
      if (index === -1) return;
      const remaining = tabs.filter((t) => t.id !== id);

      let nextActiveId = activeTabId;
      if (activeTabId === id) {
        const neighbor = remaining[index] ?? remaining[index - 1];
        nextActiveId = neighbor?.id ?? "";
      }
      set({ tabs: remaining, activeTabId: nextActiveId });
    },

    setActiveTab: (id) => set({ activeTabId: id }),

    // Called on connect/disconnect so tabs from a previous server/database
    // don't linger — the zustand store is a module-level singleton that
    // otherwise survives AppShell unmounting when the user disconnects.
    resetTabs: () => {
      const tab: QueryTab = { id: makeId(), title: "SQLQuery1.sql", initialSql: "" };
      set({ tabs: [tab], activeTabId: tab.id });
    },
  };
});
