# MyCollection — clone + car sharing

A mobile-first, full-stack vehicle collection manager inspired by MyCollection,
extended with a **private / club car-sharing** feature.

Built with **Next.js 14 (App Router) + TypeScript + Tailwind CSS**, with a zero-dependency
database layer on **Node 22's built-in `node:sqlite`** (no external DB server, no native build).

## Features

**Collection (replicated)**
- Sign in / register (two-pane layout), cookie sessions
- Collection overview — vehicle cards with search, filter by visibility, and sort
- Add a car
- Per-car detail tabs:
  - **Profile** — hero image (change image; "Enhance Image" is an AI placeholder hook), editable specs (model, cylinders, performance, mileage, colour, VIN)
  - **Gallery** — photo grid
  - **Documents** — table with category/type, "uploaded by", links
  - **Expenses** — total / entries / average-annual cards, category donut chart, entries table
  - **Timeline** — cinematic banner + vertical event timeline (auto-seeds "The beginning")
- **Expense Manager** — aggregate cost summary, category donut, cost-per-car breakdown
- A per-car **Private / Shared / Public** visibility badge

**Car sharing (the new feature)**
- **Clubs** — create a club, get an invite code, join with a code, see members
- **Share a car into a club** — toggle "require approval" (vs. instant booking)
- **Booking** — members browse cars shared with their clubs and request dates; overlap detection prevents double-booking
- **Approvals** — owners approve / decline requests; borrowers can cancel
- **Handover log** — pickup & return checklist with mileage / fuel readings and damage reporting

## Requirements

- **Node.js 22.5 or newer** (uses the built-in `node:sqlite` module). Tested on Node 22.22.
  - If your Node version reports `node:sqlite` as unavailable, run with
    `NODE_OPTIONS=--experimental-sqlite`.

## Getting started

```bash
cp .env.example .env       # then set SESSION_SECRET (openssl rand -hex 32)
npm install
npm run seed               # creates ./data/app.db and loads demo data
npm run dev                # http://localhost:3000
```

Open http://localhost:3000 and sign in with the demo account:

| Email | Password |
|-------|----------|
| `demo@mycollection.world` | `password` |
| `alex@example.com` | `password` |
| `sam@example.com` | `password` |

The seeded club invite code is **`GARAGE`**. Sign in as `demo`, you'll see a pending
booking request to approve; sign in as `alex` to request a car from the club.

## Production build

```bash
npm run build
npm run start    # serves on http://localhost:3000
```

## Configuration

Environment variables (see `.env.example`):

- `SESSION_SECRET` — secret used to sign session cookies. **Required in production** — the app refuses to start with `NODE_ENV=production` if it's missing or set to the dev fallback. Generate with `openssl rand -hex 32`.
- `DATA_DIR` — optional. Directory for the SQLite file (`app.db`). Defaults to `./data`. In a container, point at a mounted persistent volume.

## Production checklist

What the app does automatically once you set `NODE_ENV=production`:

- Refuses to boot if `SESSION_SECRET` is missing/empty/dev-fallback.
- Sends `Content-Security-Policy` (nonce + `strict-dynamic`), HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, and a locked-down `Permissions-Policy` on every response (see `src/middleware.ts`).
- Sets `secure: true` on the session cookie.

What you still need to do per environment:

- Rate limits on `loginAction` / `registerAction` are in-process (`src/lib/rate-limit.ts`). They work fine for a single-process deploy; for multi-instance setups swap in an external store.
- Image hosts are limited to `images.unsplash.com` in `next.config.js`. Add your production storage origin before wiring real uploads.
- `npm run seed` **wipes** the database — never run it against a live app.

A `GET /healthz` endpoint returns `{ "ok": true }` for uptime probes.

## Share with my phone (Cloudflare Tunnel)

Need to view the running app from a phone or another network without standing up a real deploy. `cloudflared` opens a free public HTTPS URL that forwards to `localhost:3000` while your laptop is on.

```bash
brew install cloudflared

# terminal 1
npm run dev

# terminal 2 — prints a https://*.trycloudflare.com URL
cloudflared tunnel --url http://localhost:3000
```

Open the printed URL on your phone. The tunnel URL changes each run and stops when the laptop sleeps. For a stable URL, create a named tunnel against a Cloudflare account + domain (see Cloudflare's "Set up a tunnel" docs).

The rate limiter reads `cf-connecting-ip` / `x-forwarded-for`, so limits apply per real visitor IP behind the tunnel.

## Project structure

```
src/
  app/
    (auth)/                     login & register + auth server actions
    dashboard/
      layout.tsx                top nav (desktop) + bottom tab bar (mobile)
      collection/               overview, add car, and [id]/ detail tabs
        [id]/profile|gallery|documents|expenses|timeline|share
      expense-manager/          global cost dashboard
      sharing/                  clubs hub, [clubId] club page, booking/[id] handover
      profile/                  account + sign out
  components/                   nav, donut chart, modal, image, status pill, etc.
  lib/
    db.ts                       node:sqlite connection (lazy) + schema migrate
    repo.ts                     typed repository functions
    session.ts / auth.ts        HMAC-signed cookie sessions + bcrypt
    types.ts / constants.ts / format.ts
scripts/
  seed.mjs / schema.sql         demo data seeder
```

## Notes & next steps

- The database auto-migrates its schema on first connection, so no migration step is needed.
- File uploads (documents, gallery, car photos) currently take a URL. Wire the
  upload fields to your object store (S3 / R2 / Supabase Storage) to accept real files.
- "Enhance Image" is a stub — connect it to your image model of choice.
- Re-running `npm run seed` resets the demo data.
- **Always-on hosting** — the tunnel above keeps the laptop in the loop. For 24/7 hosting without a DB rewrite, Docker on Fly.io / Railway / Render with a persistent volume is the natural next step (single container, mount `/data`, set `SESSION_SECRET`).
```
