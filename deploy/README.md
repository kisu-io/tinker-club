# VPS Deploy (Docker + Caddy + Supabase Postgres)

Single-instance deploy: the app (one replica) behind Caddy (automatic HTTPS),
backed by Supabase Postgres (no local database file). See `../docs/PRODUCTION.md`
for the operational model and constraints.

## Prerequisites
- A VPS (1 GB RAM is plenty) with **Docker** + the **Compose plugin** installed.
- A domain with an **A/AAAA record pointing at the VPS IP** (for HTTPS).
- Ports **80** and **443** open.
- A **Supabase** project (free tier is fine) with a Postgres database. Grab the
  connection string from Project Settings → Database → Connection string.

## First deploy
```bash
# on the VPS, from a copy of this repo:
cd deploy
cp .env.example .env
#  - SESSION_SECRET: openssl rand -hex 32   (set once, keep stable)
#  - DATABASE_URL:    your Supabase connection string
#  - DOMAIN:          your real domain (or :80 for a local HTTP-only test)
#  - ACME_EMAIL:      your email
nano .env

docker compose up -d --build
```
Caddy fetches a TLS cert on the first HTTPS request. Then:
```bash
curl -s https://YOUR_DOMAIN/healthz   # -> {"ok":true}
```
The schema auto-migrates on first connect (CREATE TABLE IF NOT EXISTS).

## Seed demo data (optional)
The seed script talks to the same Supabase Postgres via `DATABASE_URL`:
```bash
# from the project root, locally or on the VPS:
cp deploy/.env .env   # or set DATABASE_URL in the root .env
npm run seed
```
**Warning:** `seed` wipes all rows first. Don't run it against a production DB
with real users. Use it once on a fresh Supabase project to load demo data, or
skip it entirely and let real users register themselves.

## Update to a new version
```bash
git pull           # or copy the new code over
cd deploy
docker compose up -d --build   # rebuilds the app image, recreates the container
```
State lives in Supabase — no local volumes to worry about.

## Backups
Backups are Supabase's responsibility — enable Point-in-Time Recovery (PITR) or
scheduled backups in the Supabase dashboard. Test a restore once.

## Operate
```bash
docker compose ps              # status + health
docker compose logs -f app     # app logs
docker compose logs -f caddy   # TLS / proxy logs
docker compose restart app     # restart app only
docker compose down            # stop (Supabase data is untouched)
```

## Notes / constraints
- **One replica only** — the auth rate limiter is in-process. Do not scale `app`
  to >1. (Postgres itself handles concurrent connections fine; the constraint is
  the in-process limiter.)
- The app port (3000) is **not published to the host**; only Caddy (80/443) is
  public. The app binds inside the compose network as `app:3000`.
- `SESSION_SECRET` must stay constant across deploys or all sessions invalidate.
- `DATABASE_URL` must stay constant across deploys (same Supabase project).
- Caddy's `caddy-data` volume holds your certs/account keys — keep it.