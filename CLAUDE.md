# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run seed     # wipes all tables and reloads demo data (requires DATABASE_URL)
npm run dev      # http://localhost:3000
npm run build
npm run start
npm run lint     # next lint
npm test         # node --test — requires DATABASE_URL_TEST (or DATABASE_URL)
```

Tests use Node's built-in `node --test` with native TypeScript type-stripping plus a small ESM loader (`tests/loader.mjs`) for extensionless imports. Tests require a Postgres test database — set `DATABASE_URL_TEST` to a scratch database (tests truncate all tables on setup).

Demo credentials (after `npm run seed`):
- `demo@mycollection.world` / `password` (owner, has incoming booking to approve)
- `alex@example.com` / `password` (borrower)
- `sam@example.com` / `password`
- Seeded club invite code: `GARAGE`

## Architecture

Next.js 14 App Router + TypeScript + Tailwind. Server Components by default; mutations go through Server Actions (`"use server"`), not API routes. There are no `app/api/*` route handlers — every write path is a Server Action colocated with the route that triggers it (e.g. `dashboard/collection/actions.ts`, `dashboard/collection/[id]/detail-actions.ts`, `dashboard/sharing/actions.ts`, `(auth)/actions.ts`).

### Data layer: Postgres (Supabase)

- `src/lib/db.ts` — opens a lazy singleton `postgres` connection. `conn()` is async and awaits the first-run migration before returning the handle. The singleton is cached on `globalThis.__mcDb`. Schema auto-migrates via `src/lib/migrate.ts` on first connect (idempotent `CREATE TABLE IF NOT EXISTS`).
- `src/lib/migrate.ts` — shared migration runner. Runs `schema.sql` as a single multi-statement query (no `;`-splitter) + backfills Club slugs. Used by `db.ts` on startup.
- `src/lib/repo.ts` — typed namespaces (`Users`, `Vehicles`, `Expenses`, `Documents`, `Timeline`, `Gallery`, `Clubs`, `Memberships`, `Shares`, `Bookings`, `Handovers`) plus aggregate helpers and atomic transaction wrappers (`shareVehicleAtomic`, `unshareVehicleAtomic`, `requestBookingAtomic`). All SQL lives here; routes and actions should call these, not raw `get`/`all`/`run`.
- `scripts/schema.sql` — PostgreSQL DDL. All timestamps use `TIMESTAMPTZ NOT NULL DEFAULT now()`. Date-only columns (`Expense.date`, `Booking.startDate/endDate`) are `TEXT` storing `YYYY-MM-DD` (parameterized queries cast with `::date`).
- `scripts/seed.mjs` — wipes and reseeds demo data. Runs the schema as a single multi-statement query (same approach as `migrate.ts`).

### Auth & sessions

- `src/lib/session.ts` — HMAC-SHA256 signed cookie (`mc_session`), 30-day expiry, constant-time signature compare. `secure` flag follows `COOKIE_SECURE` env var (set `COOKIE_SECURE=false` for HTTP-only deploys; default is `true` in production). Reads/writes `cookies()` directly, so it must only be called from Server Components, Server Actions, or route handlers. **`SESSION_SECRET` must be set in production**; falls back to a dev-insecure default otherwise.
- `src/lib/auth.ts` — `requireUser()` redirects to `/login` if no session; `dashboard/layout.tsx` calls it once so every nested route is gated. `hashPassword`/`verifyPassword` use `bcryptjs` (pure JS, no native build). Cost factor 12.
- `src/lib/rate-limit.ts` — in-process sliding-window limiter. **Single-replica only** — multi-instance deploys need an external store (Redis/Postgres table).

### Routing layout

- `src/app/(auth)/` — login + register pages share a two-pane layout; `actions.ts` holds `loginAction`/`registerAction`/`logoutAction`.
- `src/app/dashboard/layout.tsx` — auth gate, top nav (desktop) + bottom tab bar (mobile).
- `src/app/dashboard/collection/[id]/` — vehicle detail uses a nested `layout.tsx` with the `CarHeader` shell; each tab (`profile|gallery|documents|expenses|timeline|share`) is a child segment with its own `page.tsx` and tab-specific `Add*Button.tsx` client component.
- `src/app/dashboard/sharing/` — clubs hub, `[clubId]` club page, and `booking/[id]` handover form.

### Sharing & booking domain rules

These rules are enforced in the repo layer / actions, not the UI:

- A car is bookable by user U iff a `VehicleShare` row exists joining the car's club to U's `ClubMembership`, **and** U is not the owner (`Shares.bookableFor`, `Shares.isBookableBy`).
- `requireApproval` on `VehicleShare` decides whether a new `Booking` is created as `PENDING` (owner must approve) or `APPROVED` (instant).
- Double-booking is prevented by `requestBookingAtomic`, which checks overlap and inserts inside a single transaction (`sql.begin()`).
- `decideBooking` only allows transitioning from `PENDING` → `APPROVED`/`DECLINED`. `cancelBooking` rejects `COMPLETED`/`CANCELLED` bookings. `completeBooking` only allows `APPROVED` → `COMPLETED`.
- The `OWNER` membership cannot be removed via `Memberships.remove` (SQL filters `role != 'OWNER'`).
- One `HandoverLog` per `Booking` (UNIQUE constraint); `Handovers.upsert` uses `ON CONFLICT ("bookingId") DO UPDATE` with `COALESCE` to preserve existing field values when partial updates are passed.

### Design system

Before changing any UI surface, read `design-system/tinker-club/MASTER.md` — it's the source of truth for typography (Playfair Display + Inter), color (premium dark + `#DC2626` action red), spacing, shadows, and component specs. Page-specific overrides live in `design-system/tinker-club/pages/<page>.md` and take precedence when present.

### Conventions

- Path alias: `@/*` → `src/*`.
- Visibility is a string enum `'PRIVATE' | 'CLUB' | 'PUBLIC'` stored as TEXT; booking status is `'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED'` — see `src/lib/types.ts`.
- Boolean-ish columns (`requireApproval`, `damageReported`, `matchingNumbers`) are stored as INTEGER 0/1 — keep that representation when adding queries.
- `next.config.js` allows remote images from any HTTPS host (vehicle/gallery photos take URLs); there is no upload pipeline yet — wiring object storage is an explicit TODO in the README.
- "Enhance Image" on the profile tab is a UI stub; no AI integration exists.