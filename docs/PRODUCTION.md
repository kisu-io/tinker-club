# Production Deploy & Operations

## Dependency security
- `next` is pinned to **14.2.35** — the latest patched release in the 14.2 line
  (fixes the Dec 2025 advisory; 14.2.18 was deprecated). `postcss` devDep bumped to 8.5.x.
- `npm audit` still reports `next` (high) + a `postcss` bundled inside `next` (moderate),
  because npm's advisory ranges only credit the 15.x/16.x fixes, not the 14.2.x backports.
  These are **not** cleared by staying on 14.2.x. Do NOT run `npm audit fix --force` — it
  pulls `next@16` (React 19 + breaking App Router changes), a separate major-upgrade project.
- Action item: schedule a deliberate **Next 16 major upgrade** later; until then 14.2.35 is the
  patched, supported choice.

## Target
One container, one SQLite database on a persistent volume. Serves all groups
(≤20 groups × ≤20 users). Path-based group URLs (`/g/<slug>`) — no wildcard DNS needed.

## Hosts (pick one)
- **Fly.io** — `fly launch`, attach a volume (`fly volumes create data -s 1`), mount at `/data`, set `DATA_DIR=/data`.
- **Railway** — add a Volume mounted at `/data`, set `DATA_DIR=/data`.
- **Render** — Web Service from Dockerfile + a Disk mounted at `/data`, set `DATA_DIR=/data`.

## Required environment
- `SESSION_SECRET` — `openssl rand -hex 32`. The app refuses to boot in production
  without a real one (rejects empty, <32 chars, and placeholder-looking values).
- `DATA_DIR=/data` — the mounted volume path.
- `NODE_ENV=production` (set by the image).

The Dockerfile sets a throwaway `SESSION_SECRET` in the BUILD stage only (so Next's
production page-data collection, which loads the session guard, succeeds). It is NOT
present in the run stage — you MUST supply a real `SESSION_SECRET` at runtime.

## Scaling constraint
Run **exactly one instance**. The SQLite connection and the auth rate limiter are
in-process; a second instance would get a separate DB and split rate-limit state.
This is fine for the target scale.

## Backups (do not skip)
The whole app is one file: `/data/app.db`. Options:
- Volume snapshots on the host (simplest).
- Cron `sqlite3 /data/app.db ".backup '/data/backup-$(date +%F).db'"` then copy off-box.
- Or add Litestream later to stream the WAL to S3/R2.
Test a restore at least once.

## Health
`GET /healthz` → `{"ok":true}`. Point the platform's health check here.

## Seeding
For a fresh prod DB, **do nothing** — the schema auto-migrates on first query and real
users register themselves. That is the intended production path.

`npm run seed` / `node scripts/seed.mjs` **wipes** the DB — never run it against live data.
It also **cannot run inside the slim runtime container**: `output: standalone` only ships
the dependencies webpack traced for the app, and `seed.mjs` is a plain Node script that
imports `bcryptjs` from `node_modules` (absent in the standalone image). To load demo data,
run seed where the full dependency tree exists — e.g. on a build host against the mounted
volume: `DATA_DIR=/path/to/volume npm ci && DATA_DIR=/path/to/volume npm run seed`.
(App login/registration is unaffected — bcrypt is bundled into the server chunks at build.)

## Verified (containerless smoke test, 2026-06-16)
The standalone artifact (`node .next/standalone/server.js`, the same entrypoint the image
uses) was run with `NODE_ENV=production` + a real `SESSION_SECRET` + `DATA_DIR`:
`/healthz` → `{"ok":true}`; `/login` → 200; `/` and `/g/<slug>` → 307 to `/login` when
unauthenticated (no leak); all prod security headers present (CSP, HSTS, X-Frame-Options,
etc.); booting without `SESSION_SECRET` → the session route 500s (prod guard fires).
The literal `docker build` still needs running once on a Docker-capable host.

## Local container smoke test
```bash
docker build -t mycollection .
docker run --rm -p 3000:3000 \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -v mycollection-data:/data \
  mycollection
curl -s localhost:3000/healthz   # -> {"ok":true}
```
