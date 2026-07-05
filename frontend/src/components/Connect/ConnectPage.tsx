import { useState } from "react";
import { useConnectionStore } from "../../lib/store/connection";

function parseServerInput(input: string): { server: string; port?: number } {
  // SSMS lets you type "host,port" directly in the server name field —
  // support that same shorthand here rather than forcing a separate field.
  const [hostPart, portPart] = input.split(",").map((s) => s.trim());
  const port = portPart ? Number(portPart) : undefined;
  return { server: hostPart, port: port && Number.isFinite(port) ? port : undefined };
}

export function ConnectPage() {
  const { status, error, remembered, connect } = useConnectionStore();

  const [serverInput, setServerInput] = useState(() => {
    if (!remembered) return "";
    return remembered.port ? `${remembered.server},${remembered.port}` : remembered.server;
  });
  const [database, setDatabase] = useState(remembered?.database ?? "TRAINING");
  const [username, setUsername] = useState(remembered?.username ?? "");
  const [password, setPassword] = useState("");
  // Defaults on: most cloud-hosted SQL Server instances (AWS RDS, Azure SQL,
  // ...) present a certificate chain that isn't in a browser/Node's default
  // trusted root store, which otherwise fails as a cryptic "unable to get
  // local issuer certificate" error — the norm for this app's use case, not
  // the exception, so it shouldn't be an opt-in trap for students to find.
  const [trustServerCertificate, setTrustServerCertificate] = useState(true);

  const isConnecting = status === "connecting";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { server, port } = parseServerInput(serverInput);
    if (!server || !username || !password) return;
    void connect({
      server,
      port,
      database: database.trim() || undefined,
      username,
      password,
      trustServerCertificate,
    });
  }

  return (
    <div className="flex h-screen items-center justify-center bg-bg text-fg">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-md border border-border bg-surface p-6 shadow-lg"
      >
        <h1 className="mb-1 text-lg font-semibold">Connect to Server</h1>
        <p className="mb-4 text-xs text-fg-muted">
          Connect to any SQL Server instance — like SSMS's Connect dialog.
        </p>

        <label className="mb-3 block text-xs">
          <span className="mb-1 block text-fg-muted">Server name</span>
          <input
            type="text"
            required
            autoFocus
            value={serverInput}
            onChange={(e) => setServerInput(e.target.value)}
            placeholder="myserver.example.com,1433"
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg"
          />
        </label>

        <label className="mb-3 block text-xs">
          <span className="mb-1 block text-fg-muted">Database (optional)</span>
          <input
            type="text"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            placeholder="Defaults to the login's default database"
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg"
          />
        </label>

        <label className="mb-3 block text-xs">
          <span className="mb-1 block text-fg-muted">Username</span>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg"
          />
        </label>

        <label className="mb-3 block text-xs">
          <span className="mb-1 block text-fg-muted">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg"
          />
        </label>

        <label className="mb-4 flex items-center gap-2 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={trustServerCertificate}
            onChange={(e) => setTrustServerCertificate(e.target.checked)}
          />
          Trust server certificate
        </label>

        {status === "error" && error && (
          <p className="mb-3 rounded border border-danger/40 bg-danger/10 px-2 py-1.5 text-xs text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isConnecting}
          className="w-full rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          {isConnecting ? "Connecting…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
