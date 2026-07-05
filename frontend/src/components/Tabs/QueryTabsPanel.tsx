import { useQueryTabsStore } from "../../lib/store/queryTabs";
import { QueryWorkspace } from "../QueryWorkspace/QueryWorkspace";
import { QueryTabBar } from "./QueryTabBar";

export function QueryTabsPanel() {
  const tabs = useQueryTabsStore((s) => s.tabs);
  const activeTabId = useQueryTabsStore((s) => s.activeTabId);
  const addTab = useQueryTabsStore((s) => s.addTab);

  return (
    <div className="flex h-full flex-col">
      <QueryTabBar />

      {tabs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-fg-muted">
          <p>No open queries.</p>
          <button
            type="button"
            onClick={() => addTab()}
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-accent-fg"
          >
            New Query
          </button>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          {tabs.map((tab) => (
            // Every tab stays mounted (just visually hidden) so switching
            // tabs never resets an in-flight edit or a result set already
            // rendered — matching how SSMS keeps query windows alive.
            <div key={tab.id} className={tab.id === activeTabId ? "h-full" : "hidden"}>
              <QueryWorkspace initialSql={tab.initialSql} autoRun={tab.autoRun} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
