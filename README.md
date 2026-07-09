# belajarsql

A browser-based, SSMS-like SQL Server client for students: connect to any SQL Server, browse schemas, run read-only queries, and export results — no local install required.

## Architecture

Two deployables, because GitHub Pages can only serve static files and something has to actually hold SQL Server connections:

- **`frontend/`** — React + Vite static app, deployed to GitHub Pages.
- **`backend/`** — Fastify API (Node.js), deployed to Render. Never persists a fixed DB credential of its own — students connect through the app's Connect page (server, optional database, username, password, like SSMS's Connect dialog), and the backend opens a dedicated connection pool per session, keyed by a random session token returned to the browser.
- **`shared/`** — TypeScript types shared between both (the API contract).

There is no student account system beyond that per-session token — a session lives only as long as the connection is open, and is swept after `SESSION_IDLE_TIMEOUT_MS` of inactivity.

## Local development

```bash
pnpm install
cp backend/.env.example backend/.env   # tuning defaults only — no DB credentials to fill in
pnpm --filter @belajarsql/shared build
pnpm dev:backend     # http://localhost:4000
pnpm dev:frontend    # http://localhost:5173 (proxies /api to :4000 in dev)
```

Open http://localhost:5173 and use the Connect page to point at any reachable SQL Server (server accepts SSMS's `host,port` shorthand directly in the one field).

## Deploying the backend (Render)

1. Push this repo to GitHub, then in Render: **New > Blueprint**, point it at the repo. `render.yaml` at the repo root defines the service.
2. Fill in the env var Render prompts for (`sync: false` in `render.yaml`): `CORS_ALLOWED_ORIGINS` (the frontend's real origin(s), comma-separated — e.g. `https://sql.yourdomain.com`).
3. Once deployed, note the Render URL (`https://<service>.onrender.com`) — needed for the two GitHub Actions repo variables below.
4. Render's free tier sleeps after ~15 min idle (30-50s cold start on the next request). `.github/workflows/keep-backend-warm.yml` pings `/api/health` every 10 minutes to mitigate this — set the `BACKEND_HEALTH_URL` repo variable to enable it, or just delete the workflow if the cold start doesn't matter in practice.

## Deploying the frontend (GitHub Pages) + rumahweb.com domain

1. Repo **Settings > Pages** — set source to "GitHub Actions".
2. Repo **Settings > Secrets and variables > Actions > Variables** — add:
   - `VITE_API_BASE_URL` = the Render backend URL from above.
   - `BACKEND_HEALTH_URL` = `<that URL>/api/health` (only if using the keep-warm workflow).
3. Push to `main` (touching `frontend/**`) to trigger `.github/workflows/deploy-frontend.yml`.
4. Custom domain: in **Settings > Pages**, enter the domain (e.g. `sql.yourdomain.com`) — GitHub writes `frontend/public/CNAME`-equivalent on its own via the Pages UI, but since this repo builds `frontend/dist` from source each time, instead **add the file yourself**: create `frontend/public/CNAME` containing just the domain name (no protocol), so it survives every rebuild.
5. In rumahweb.com's DNS panel (rumahweb is only the DNS/registrar here — it has no role in serving the app):
   - Subdomain (e.g. `sql.yourdomain.com`): a `CNAME` record pointing to `<github-username>.github.io`.
   - Apex/root domain (e.g. `yourdomain.com`): four `A` records pointing to GitHub Pages' IPs (`185.199.108.153`, `.109.153`, `.110.153`, `.111.153`).

## Security model

- No fixed backend credential — students authenticate directly against their own SQL Server with their own login, scoped by whatever that login can see there.
- Passwords and session tokens are redacted from backend logs (`server.ts`'s pino `redact` config); passwords are never persisted client-side (only server/database/username are remembered in `localStorage`, for form convenience).
- CORS locked to configured origins (`CORS_ALLOWED_ORIGINS`), no wildcard.
- Per-IP rate limiting — stricter on `/api/connect` (opens a real DB connection per attempt) and `/api/query/execute` than on cached `/api/schema`.
- Only `SELECT`/`WITH` statements are accepted, plus one carve-out: creating, populating, modifying, or dropping a local temp table (`#name`) is allowed so students can use temp tables as scratch space. Everything else — mutations against real tables, `##global` temp tables, `EXEC`, etc. — is rejected server-side by a deny-list, independent of whatever permissions the connecting login actually has (`backend/src/lib/sqlGuard.ts`).
- Each session gets exactly one dedicated SQL Server connection (not a multi-connection pool), so a student's local temp tables are only ever visible on that one connection/SPID — invisible to every other session, even one using the same shared SQL login from a different computer.
- Query execution is streamed and capped (`MAX_ROWS_DEFAULT`/`MAX_ROWS_HARD_CAP`) with a statement timeout, and idle sessions are closed after `SESSION_IDLE_TIMEOUT_MS` — bounds how much load one query, script, or forgotten tab can put on a connection.
