# Production Deploy & Operations

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
`npm run seed` / `node scripts/seed.mjs` **wipes** the DB. Never run against live data.
For a fresh prod DB, do nothing — the schema auto-migrates on first query.

## Local container smoke test
```bash
docker build -t mycollection .
docker run --rm -p 3000:3000 \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -v mycollection-data:/data \
  mycollection
curl -s localhost:3000/healthz   # -> {"ok":true}
```
