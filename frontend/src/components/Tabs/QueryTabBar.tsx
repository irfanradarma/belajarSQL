import { useQueryTabsStore } from "../../lib/store/queryTabs";

export function QueryTabBar() {
  const tabs = useQueryTabsStore((s) => s.tabs);
  const activeTabId = useQueryTabsStore((s) => s.activeTabId);
  const setActiveTab = useQueryTabsStore((s) => s.setActiveTab);
  const closeTab = useQueryTabsStore((s) => s.closeTab);
  const addTab = useQueryTabsStore((s) => s.addTab);

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-surface px-1">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 py-1.5 text-xs ${
              isActive
                ? "border-accent bg-bg text-fg"
                : "border-transparent text-fg-muted hover:bg-bg/60"
            }`}
          >
            <span className="max-w-[12rem] truncate">{tab.title}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              aria-label={`Close ${tab.title}`}
              className="rounded px-1 text-fg-muted opacity-0 hover:bg-danger/20 hover:text-danger group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => addTab()}
        aria-label="New query tab"
        className="ml-1 shrink-0 rounded px-2 py-1 text-sm text-fg-muted hover:bg-bg/60"
      >
        +
      </button>
    </div>
  );
}
