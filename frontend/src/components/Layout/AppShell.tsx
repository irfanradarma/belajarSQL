import { useConnectionStore } from "../../lib/store/connection";
import { ObjectExplorerTree } from "../ObjectExplorer/ObjectExplorerTree";
import { QueryTabsPanel } from "../Tabs/QueryTabsPanel";
import { ThemeSwitcher } from "../ThemeSwitcher/ThemeSwitcher";

export function AppShell() {
  const server = useConnectionStore((s) => s.server);
  const database = useConnectionStore((s) => s.database);
  const username = useConnectionStore((s) => s.username);
  const disconnect = useConnectionStore((s) => s.disconnect);

  return (
    <div className="flex h-screen flex-col bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <h1 className="text-sm font-semibold">belajarsql</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-fg-muted" title={`${server} · ${database} · ${username}`}>
            {username}@{server}
            {database ? ` · ${database}` : ""}
          </span>
          <button
            type="button"
            onClick={() => void disconnect()}
            className="rounded border border-border px-2 py-0.5 text-xs text-fg-muted hover:bg-accent/10"
          >
            Disconnect
          </button>
          <ThemeSwitcher />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 border-r border-border bg-surface">
          <ObjectExplorerTree />
        </aside>

        <main className="min-w-0 flex-1">
          <QueryTabsPanel />
        </main>
      </div>
    </div>
  );
}
