# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run seed     # wipes ./data/app.db and reloads demo data (idempotent)
npm run dev      # http://localhost:3000
npm run build
npm run start
npm run lint     # next lint
```

There is no test runner configured.

If Node reports `node:sqlite` as unavailable, run with `NODE_OPTIONS=--experimental-sqlite`. Node 22.5+ is required (declared in `engines`).

Demo credentials (after `npm run seed`):
- `demo@mycollection.world` / `password` (owner, has incoming booking to approve)
- `alex@example.com` / `password` (borrower)
- `sam@example.com` / `password`
- Seeded club invite code: `GARAGE`

## Architecture

Next.js 14 App Router + TypeScript + Tailwind. Server Components by default; mutations go through Server Actions (`"use server"`), not API routes. There are no `app/api/*` route handlers — every write path is a Server Action colocated with the route that triggers it (e.g. `dashboard/collection/actions.ts`, `dashboard/collection/[id]/detail-actions.ts`, `dashboard/sharing/actions.ts`, `(auth)/actions.ts`).

### Data layer: `node:sqlite`, not Prisma

Despite `prisma/schema.prisma` existing in the tree, **Prisma is not used at runtime** — it is a historical reference for the schema. The live data layer is:

- `src/lib/db.ts` — opens a singleton `DatabaseSync` from Node 22's built-in `node:sqlite`. The connection is **lazy** (opened on first query, not at import) so Next's static-analysis workers don't touch the file during build. The singleton is cached on `globalThis.__mcDb` to survive dev hot reloads. Schema is auto-migrated via `CREATE TABLE IF NOT EXISTS` on every open — there is no migration step.
- `src/lib/repo.ts` — typed namespaces (`Users`, `Vehicles`, `Expenses`, `Documents`, `Timeline`, `Gallery`, `Clubs`, `Memberships`, `Shares`, `Bookings`, `Handovers`) plus aggregate helpers. All SQL lives here; routes and actions should call these, not raw `get`/`all`/`run`.
- `src/sqlite.d.ts` — ambient declaration for `node:sqlite` because `@types/node` 20.x does not include it. Keep this file if you upgrade `@types/node` until the upstream types ship.
- `scripts/seed.mjs` + `scripts/schema.sql` — `npm run seed` wipes and reseeds demo data. The seed script duplicates the schema in `scripts/schema.sql`; if you change tables in `db.ts`, mirror them in `scripts/schema.sql` too.
- `DATA_DIR` env var overrides the default `./data` location for `app.db`.

### Auth & sessions

- `src/lib/session.ts` — HMAC-SHA256 signed cookie (`mc_session`), 30-day expiry, constant-time signature compare. Reads/writes `cookies()` directly, so it must only be called from Server Components, Server Actions, or route handlers. **`SESSION_SECRET` must be set in production**; falls back to a dev-insecure default otherwise.
- `src/lib/auth.ts` — `requireUser()` redirects to `/login` if no session; `dashboard/layout.tsx` calls it once so every nested route is gated. `hashPassword`/`verifyPassword` use `bcryptjs` (pure JS, no native build).

### Routing layout

- `src/app/(auth)/` — login + register pages share a two-pane layout; `actions.ts` holds `loginAction`/`registerAction`/`logoutAction`.
- `src/app/dashboard/layout.tsx` — auth gate, top nav (desktop) + bottom tab bar (mobile).
- `src/app/dashboard/collection/[id]/` — vehicle detail uses a nested `layout.tsx` with the `CarHeader` shell; each tab (`profile|gallery|documents|expenses|timeline|share`) is a child segment with its own `page.tsx` and tab-specific `Add*Button.tsx` client component.
- `src/app/dashboard/sharing/` — clubs hub, `[clubId]` club page, and `booking/[id]` handover form.

### Sharing & booking domain rules

These rules are enforced in the repo layer / actions, not the UI:

- A car is bookable by user U iff a `VehicleShare` row exists joining the car's club to U's `ClubMembership`, **and** U is not the owner (`Shares.bookableFor`, `Shares.isBookableBy`).
- `requireApproval` on `VehicleShare` decides whether a new `Booking` is created as `PENDING` (owner must approve) or `APPROVED` (instant).
- Double-booking is prevented by `Bookings.overlapping`, which checks `PENDING`/`APPROVED` rows whose date range intersects the requested range.
- The `OWNER` membership cannot be removed via `Memberships.remove` (SQL filters `role != 'OWNER'`).
- One `HandoverLog` per `Booking` (UNIQUE constraint); `Handovers.upsert` preserves existing field values when partial updates are passed.

### Design system

Before changing any UI surface, read `design-system/tinker-club/MASTER.md` — it's the source of truth for typography (Playfair Display + Inter), color (premium dark + `#DC2626` action red), spacing, shadows, and component specs. Page-specific overrides live in `design-system/tinker-club/pages/<page>.md` and take precedence when present.

The current implementation does **not** yet match the design system — Inter-only, no display serif, dead `accent: #7c5cff` token in `tailwind.config.ts`, uniform `.card` pattern everywhere. Treat MASTER as the target, current Tailwind config as legacy.

### Conventions

- Path alias: `@/*` → `src/*`.
- Visibility is a string enum `'PRIVATE' | 'CLUB' | 'PUBLIC'` stored as TEXT; booking status is `'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED'` — see `src/lib/types.ts`.
- Boolean-ish columns (`requireApproval`, `damageReported`) are stored as INTEGER 0/1 — keep that representation when adding queries.
- `next.config.js` allows remote images from any HTTPS host (vehicle/gallery photos take URLs); there is no upload pipeline yet — wiring object storage is an explicit TODO in the README.
- "Enhance Image" on the profile tab is a UI stub; no AI integration exists.
