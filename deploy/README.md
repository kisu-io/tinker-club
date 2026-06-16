# VPS Deploy (Docker + Caddy)

Single-instance deploy: the app (one replica, persistent SQLite volume) behind
Caddy (automatic HTTPS). See `../docs/PRODUCTION.md` for the operational model
and constraints.

## Prerequisites
- A VPS (1 GB RAM is plenty) with **Docker** + the **Compose plugin** installed.
- A domain with an **A/AAAA record pointing at the VPS IP** (for HTTPS).
- Ports **80** and **443** open.

## First deploy
```bash
# on the VPS, from a copy of this repo:
cd deploy
cp .env.example .env
#  - SESSION_SECRET: openssl rand -hex 32   (set once, keep stable)
#  - DOMAIN:         your real domain (or :80 for a local HTTP-only test)
#  - ACME_EMAIL:     your email
nano .env

docker compose up -d --build
```
Caddy fetches a TLS cert on the first HTTPS request. Then:
```bash
curl -s https://YOUR_DOMAIN/healthz   # -> {"ok":true}
```
The schema auto-migrates on first use; real users register themselves. (Demo
seeding does NOT work in the slim image — see "Seeding" in ../docs/PRODUCTION.md.)

## Update to a new version
```bash
git pull           # or copy the new code over
cd deploy
docker compose up -d --build   # rebuilds the app image, recreates the container
```
The `app-data` volume (your database) persists across rebuilds.

## Backups (do not skip)
The whole database is one file inside the `app-data` volume.
```bash
# dump a backup to the host
docker compose exec app sh -c "ls -la /data"
docker run --rm -v deploy_app-data:/data -v "$PWD":/out alpine \
  sh -c "cp /data/app.db /out/app-$(date +%F).db"
```
Automate this (cron) and copy backups off-box. Test a restore once.

## Operate
```bash
docker compose ps              # status + health
docker compose logs -f app     # app logs
docker compose logs -f caddy   # TLS / proxy logs
docker compose restart app     # restart app only
docker compose down            # stop (volumes preserved)
```

## Notes / constraints
- **One replica only** — SQLite is single-writer and the auth rate limiter is
  in-process. Do not scale `app` to >1.
- The app port (3000) is **not** published to the host; only Caddy (80/443) is
  public. The app binds inside the compose network as `app:3000`.
- `SESSION_SECRET` must stay constant across deploys or all sessions invalidate.
- Caddy's `caddy-data` volume holds your certs/account keys — keep it.
