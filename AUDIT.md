# Codebase Audit — Tinker Club (mycollection-clone)

**Date:** 2026-06-19  
**Auditor:** Hermes Agent (automated deep review)  
**Project:** Next.js 14 App Router vehicle collection manager, Postgres/Supabase backend  
**Commit scope:** full tree read (67 source files, 6 test files, deploy configs, schema)

---

## Executive Summary

| Dimension | Grade | One-liner |
|---|---|---|
| Architecture & Structure | **B+** | Clean Server Action pattern; dead SQLite/Prisma artifacts; migration-on-startup is risky |
| Data Layer | **C+** | Parameterized SQL is safe; schema drift, no transactions, split-brain migration, N+1 queries |
| Security | **B** | Solid session/crypto/CSP/rate-limit; race conditions, no CSRF, placeholder secret in build, missing input validation |
| Code Quality | **B** | Consistent, readable, typed; `as any` leakage, dead code, stale CLAUDE.md, no eslint config |
| Performance | **C+** | Lazy singleton good; N+1 queries, no caching, `<img>` not `<Image>`, per-vehicle round-trips |
| Testing | **D** | 6 tests, all broken against Postgres migration, 0% coverage of security/actions/repo-write paths |
| Deploy/DevOps | **B+** | Good Dockerfile/Caddy/healthcheck; single-replica limit, missing graceful shutdown, docker-compose env coupling |
| Design System | **B-** | Tailwind is clean; dead token, inconsistent accent color, missing focus-visible styles, accessibility gaps |

**Overall grade: C+ (solid hobby-quality, not production-grade without fixes in Data, Testing, and Security race conditions)**

---

## 1. Architecture & Structure — Grade: B+

### Strengths
- **Server Actions, not API routes.** Every mutation flows through `"use server"` actions colocated with its route (`(auth)/actions.ts:1`, `collection/actions.ts:1`, `collection/[id]/detail-actions.ts:1`, `sharing/actions.ts:1`). This is the recommended Next 14 pattern and keeps the trust boundary on the server.
- **Server Components by default.** Only 24 of 67 `.tsx` files are `"use client"`, and they are all genuinely interactive (modals, forms, nav). Pages that fetch data (`collection/page.tsx`, `sharing/page.tsx`, `profile/page.tsx`) remain server components. Good discipline.
- **Route groups are well-organized:** `(auth)` for login/register, `dashboard/*` for the authenticated app, `g/[slug]` for club pages with its own layout, `healthz` outside the dashboard so it's exempt from the auth gate.
- **Nested layout for vehicle detail** (`collection/[id]/layout.tsx`) resolves the vehicle + ownership once and renders `CarHeader`, so child tab pages don't repeat the guard boilerplate (though they do repeat it — see Issues).
- **`requireUser()` is called once in `dashboard/layout.tsx:16`** so every nested dashboard route is auth-gated without each page repeating it. Correct.
- **Path alias `@/*` → `src/*`** is consistently used; `tsconfig.json:17` is correct.

### Issues

| Sev | File | Issue | Fix |
|---|---|---|---|
| HIGH | `CLAUDE.md:30-38`, `src/lib/db.ts:1-43`, `tests/migration.test.ts:13` | **Stale architecture docs + dead SQLite layer.** CLAUDE.md still describes `node:sqlite`, `globalThis.__mcDb`, `DATA_DIR`, `sqlite.d.ts`. `db.ts` is now Postgres. `src/sqlite.d.ts` is unused dead code. `tests/migration.test.ts` imports `node:sqlite` and sets `DATA_DIR` — it will fail to even load against the current `db.ts` (which requires `DATABASE_URL`). | Rewrite CLAUDE.md for Postgres/Supabase. Delete `src/sqlite.d.ts`. Rewrite or remove the migration test (see Testing). |
| HIGH | `src/lib/db.ts:39` | **`void migrate(sql)` is fire-and-forget.** The first call to `conn()` returns the `sql` handle immediately while `migrate()` runs asynchronously. If the first query arrives before migration completes, it executes against a partially-migrated schema. There is no `await` gate. | Make `conn()` async and `await` a migration promise, or run migration synchronously in a module-init `await` block before exporting the handle. |
| MEDIUM | `prisma/schema.prisma:1-196` | **Dead Prisma schema** (`provider = "sqlite"`) contradicts the live Postgres schema. CLAUDE.md says "not used at runtime" but it's a trap for the next contributor. | Delete `prisma/` or convert to a `prisma/schema.prisma` with `provider = "postgresql"` matching `scripts/schema.sql`, or move the reference schema to `docs/schema-reference.prisma`. |
| MEDIUM | `src/app/dashboard/collection/[id]/layout.tsx:14` vs each tab page | **Double auth guard.** The `[id]/layout.tsx` calls `Vehicles.forOwner` to gate, then every tab page (`profile/page.tsx:38`, `expenses/page.tsx:11`, etc.) calls `requireUser()` + `Vehicles.forOwner()` again. Two DB round-trips per tab load for the same ownership check. | The layout guard is correct (it must render the shell). Tab pages should trust the layout and only re-fetch the vehicle data they need (or pass it via a context). Alternatively, accept the duplication as defense-in-depth but document it. |
| MEDIUM | `src/lib/db.ts:88-119` | **SQLite-style helper API layered over Postgres.** `get/all/run` with `?` placeholders converted to `$1,$2` via regex (`convertPlaceholders`), then dispatched through `sql.unsafe()`. This works but defeats postgres.js's tagged-template safety and prepared-statement caching. It exists only to avoid rewriting repo.ts from the SQLite era. | Migrate repo.ts to use postgres.js's tagged template literals directly (`sql\`...${param}...\``). Then `get/all/run` and `convertPlaceholders` can be deleted. |
| LOW | `src/app/page.tsx:4-6` | `Home()` is a sync server component calling `getSessionUserId()` (which reads cookies — OK in server components) but it's not async while `getSessionUserId` is sync. Works, but the pattern is inconsistent with the rest of the app using `await requireUser()`. | Minor — leave as is or make async for consistency. |
| LOW | `src/lib/group.ts:7-9` | Re-exports `checkGroupAccess` and `GroupAccess` from `group-access.ts`. Two files for one concern is a minor smell; the split is justified by testability (pure logic vs Next-coupled resolver) and is documented. | Acceptable. |

---

## 2. Data Layer — Grade: C+

### Strengths
- **All SQL is parameterized.** Every repo function uses `?`/`$N` placeholders — no string interpolation of user data into SQL. `db.ts:98-101` converts placeholders, `sql.unsafe()` receives the params array. SQL injection via the query layer is not possible.
- **Quoted identifiers** (`"User"`, `"Vehicle"`, `"ownerId"`) are used consistently, which is required for mixed-case identifiers in Postgres and prevents collision with reserved keywords.
- **Foreign keys with `ON DELETE CASCADE`** are correctly declared in `schema.sql:16,46,57,68,81,103,104,113,123,133`. Deleting a vehicle cleans up expenses, documents, timeline, gallery, shares, bookings, and handover logs automatically.
- **`UNIQUE` constraints** on `ClubMembership(clubId,userId)`, `VehicleShare(vehicleId,clubId)`, `Club.slug` (partial index + `idx_club_slug`), and `HandoverLog.bookingId` enforce domain invariants at the DB level.
- **Types are centralized** in `src/lib/types.ts` with interfaces matching each table. Repo functions are generically typed (`get<User>(...)`, `all<Vehicle>(...)`).
- **`id()` returns `crypto.randomUUID()`** (`db.ts:83-85`) — proper UUIDv4 for all primary keys.

### Issues

| Sev | File | Issue | Fix |
|---|---|---|---|
| CRITICAL | `src/lib/db.ts:45-61` vs `scripts/seed.mjs:26-29` | **Split-brain migration.** `db.ts` and `seed.mjs` both parse `schema.sql` with the same naive `split(/;\s*\n/)` splitter. This breaks on any statement containing a semicolon inside a string literal, a `DO $$ ... $$` block, or a `CREATE FUNCTION`. Currently safe because the DDL has none, but adding a trigger/function makes it silently truncate. More importantly, the app and the seed each run the DDL independently with no shared migration runner — they can drift. | Use a proper migration approach: either `psql -f schema.sql` in a deploy step, or a tagged migration tool (e.g. `node-pg-migrate`, or at minimum a single shared `runSchema(sql)` function imported by both `db.ts` and `seed.mjs`). The `;`-splitting should be replaced with a parser or `pg`'s multi-statement support. |
| HIGH | `src/lib/db.ts:51-57` | **Naive DDL splitter.** `ddl.split(/;\s*\n/).filter(s => !s.startsWith("--"))` strips line comments at the start of a statement but a `--` comment mid-statement or after a value would be passed through. Also, a statement ending without a trailing `\n` after `;` (e.g. the last `HandoverLog` table) is still split correctly because of the trailing `;`, but it's fragile. | Use `postgres`'s `sql.file()` or `sql.unsafe(ddl)` as a single multi-statement string (postgres.js sends multi-statement queries fine when `prepare: false`). Or adopt `pg-migrate`. |
| HIGH | `scripts/schema.sql:51,143` | **Inconsistent timestamp defaults.** `Expense.date` and `HandoverLog.updatedAt` use `DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSZ')` (a TEXT column with a stringified timestamp), while every other timestamp column uses `TIMESTAMPTZ NOT NULL DEFAULT now()`. This means `Expense.date` and `HandoverLog.updatedAt` are stored as text, not real timestamps, and can't be compared with `::date` casts reliably (the code does cast them: `repo.ts:108` `"eventDate"::date`, `repo.ts:247` `?::date`). `Booking.startDate/endDate` are also TEXT. | Make all date/timestamp columns `TIMESTAMPTZ` or `DATE` as appropriate. `Expense.date` → `DATE NOT NULL DEFAULT CURRENT_DATE`. `Booking.startDate/endDate` → `DATE`. `HandoverLog.updatedAt` → `TIMESTAMPTZ NOT NULL DEFAULT now()` (and use a trigger or the app's `now()` call in the upsert). |
| HIGH | `src/app/dashboard/sharing/actions.ts:110-121` + `src/lib/repo.ts:244-247` | **Booking overlap race condition (TOCTOU).** `requestBooking` checks `Bookings.overlapping()` then `Bookings.create()` in two separate statements with no transaction. Two concurrent booking requests for overlapping dates can both pass the check and both insert. No `SELECT ... FOR UPDATE` or unique exclusion constraint exists. | Wrap the check+insert in a `BEGIN ... COMMIT` transaction via `sql.begin()`, or add a Postgres exclusion constraint: `EXCLUDE USING gist ("vehicleId" WITH =, daterange("startDate"::date, "endDate"::date, '[]') WITH &&) WHERE (status IN ('PENDING','APPROVED'))`. The constraint requires the `btree_gist` extension. |
| HIGH | `src/app/dashboard/sharing/actions.ts:66-81` + `src/lib/repo.ts:198-200` | **Share/unshare + visibility flip is non-atomic.** `shareVehicle` does `Shares.add` then conditionally `Vehicles.setVisibility` in two separate queries. If the second fails, the share exists but visibility stays PRIVATE. Same for `unshareVehicle` (checks count then sets PRIVATE). | Wrap in a transaction. |
| MEDIUM | `src/app/dashboard/collection/page.tsx:15-23` | **N+1 query.** `Vehicles.ownedBy` fetches all vehicles, then `Promise.all(vehicles.map(v => Vehicles.shareCount(v.id)))` fires one `COUNT(*)` per vehicle. With N vehicles this is N+1 queries. | Add a single query: `SELECT v.*, (SELECT COUNT(*) FROM "VehicleShare" WHERE "vehicleId"=v.id) AS "shareCount" FROM "Vehicle" v WHERE v."ownerId"=? ORDER BY v."createdAt" DESC`. |
| MEDIUM | `src/app/dashboard/expense-manager/page.tsx:48-49` | **N+1 query.** For each vehicle, `categoryTotals(v.id)` is called individually inside `Promise.all`. | Fetch all category totals for the owner's vehicles in one grouped query. |
| MEDIUM | `src/lib/repo.ts:190-193` | **`as unknown as any[]` and `as any` casts** on `Shares.forClub` defeat TypeScript. The return type is declared `VehicleShare & Vehicle & { ownerName: string }` but cast away. | Define a proper `SharedVehicleRow` interface and return that. |
| MEDIUM | `src/lib/repo.ts:260-280` | **`Handovers.upsert` is read-then-write (TOCTOU).** It `SELECT`s existing, then `INSERT` or `UPDATE`. The `UNIQUE("bookingId")` constraint will raise an error on a true concurrent insert, but the function doesn't catch it — the action will 500. | Use `INSERT ... ON CONFLICT ("bookingId") DO UPDATE SET ...` (a proper Postgres upsert) instead of the manual read-then-branch. |
| MEDIUM | `src/lib/repo.ts:59` | **`shareCount` uses `(await get<{c:number}>(...))!.c`** — the `!` non-null assertion will throw at runtime if the row is somehow missing, but `COUNT(*)` always returns a row. Still, the assertion is unnecessary; `?? 0` is safer. | `(await get<{c:number}>(...))?.c ?? 0`. |
| LOW | `src/lib/db.ts:30` | **Supabase pooler detection by URL pattern** (`/supabase\.com/` or `/:6543/`). Works but a self-hosted Supabase or a different pooler port would miss it. Also, disabling prepared statements for the whole connection when it's a pooler is correct, but the detection is brittle. | Document the assumption or make `prepare` an explicit env var (`DB_PREPARE=false`). |
| LOW | `src/lib/db.ts:16` | **`globalThis.__mcDb` singleton.** In serverless/edge this may not persist across invocations, but the app is a standalone Node server (Dockerfile `CMD ["node","server.js"]`), so it's fine. Worth a comment. | Add a comment noting this assumes a long-running process. |
| LOW | `scripts/schema.sql:99` | **Partial unique index on `Club(slug)`** doesn't exclude NULLs properly for Postgres semantics. `CREATE UNIQUE INDEX ... ON "Club"(slug)` allows multiple NULLs (Postgres default), which is the intent (clubs can have null slug until backfilled). Correct, but the `slug TEXT` column is nullable while `uniqueSlug` always assigns one — consider `NOT NULL`. | Make `slug TEXT NOT NULL` after the backfill, or leave as-is if the backfill path matters. |

---

## 3. Security — Grade: B

### Strengths
- **HMAC-SHA256 signed cookies** (`session.ts:44-59`) with constant-time comparison via `crypto.timingSafeEqual`. Correct implementation.
- **Production secret validation** (`session.ts:23-39`): rejects empty, dev-fallback, <32-char, and placeholder-looking `SESSION_SECRET` values. Throws at module load in prod. This is above-average.
- **bcryptjs with cost factor 10** (`auth.ts:12`) for password hashing. Pure-JS so no native build issues in Docker. Cost 10 is the minimum acceptable; 12 would be better but 10 is fine for a hobby app.
- **CSP with nonce + strict-dynamic** (`middleware.ts:19-44`). In dev, `report-only` mode with `unsafe-inline/eval` for HMR; in prod, enforced with nonce. `frame-ancestors: none`, `object-src: none`, `base-uri: self`, `form-action: self`. Good baseline.
- **Security headers** (`middleware.ts:65-77`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera/mic/geo/FLoC, HSTS when HTTPS. Solid.
- **Rate limiting on login/register** (`actions.ts:9-13,20-23,41-43`): IP+email keyed for login (5/15min), IP-only for register (3/hour). Resets on success. Good.
- **`httpOnly` + `sameSite: lax` + conditional `secure`** on session cookie (`session.ts:70-76`). The `COOKIE_SECURE` env handling (`session.ts:14`) correctly avoids setting `Secure` on bare-HTTP deploys where browsers would drop it.
- **Authorization is server-side and defense-in-depth.** `requireUser` gates the dashboard; `Vehicles.forOwner(vid, uid)` scopes every vehicle query to the owner; `requireGroupMember` gates club pages and returns 404 for non-members (doesn't reveal existence); booking actions re-check ownership/borrower status.
- **Branding input validation** (`sharing/actions.ts:12-20`): hex color regex, https-only URL validation for logo. Prevents CSS injection and non-https logos.
- **`.env` is gitignored** (`.gitignore:17-19`) and the read_file tool correctly refused to serve it.
- **Caddy overwrites `X-Forwarded-For`** (`Caddyfile:22`) so clients can't spoof it, which makes `clientIp()` trustworthy behind this specific proxy.

### Issues

| Sev | File | Issue | Fix |
|---|---|---|---|
| HIGH | `src/app/(auth)/actions.ts:15-32` + all Server Actions | **No CSRF protection beyond `sameSite: lax`.** Server Actions in Next 14 are protected by the framework's built-in CSRF check *only when using `<form action={fn}>`*. But `loginAction`/`registerAction` accept `_prev` + `FormData` and are also directly invocable. The `sameSite: lax` cookie blocks cross-site POST form submissions, but a top-level navigation (GET) or a subdomain attack could bypass it. Next 14.2 does add an origin check for Server Actions — verify your version has it. | Ensure `next >= 14.2.5` (you're on `14.2.35`, good). Document the reliance on Next's built-in CSRF. Consider a double-submit token for defense-in-depth. |
| HIGH | `src/lib/rate-limit.ts:1-2` | **In-process rate limiter only works for a single replica.** `docker-compose.yml:16` explicitly notes "Run exactly ONE replica". If you ever scale horizontally, the limiter is per-instance and an attacker gets `MAX × instances` attempts. | Use a shared store (Redis, or Supabase `pg_table` with `INSERT ... ON CONFLICT`). At minimum, document the single-replica constraint in the rate-limit module. |
| HIGH | `src/app/dashboard/sharing/actions.ts:127-136` | **`decideBooking` allows APPROVED→DECLINED and vice versa without state machine.** It calls `Bookings.setStatus(bookingId, decision)` with no check that the current status is `PENDING`. An owner could "decline" a COMPLETED booking. | Add `if (booking.status !== "PENDING") return;` before setting. |
| MEDIUM | `src/app/dashboard/sharing/actions.ts:138-148` | **`cancelBooking` allows cancelling COMPLETED bookings.** Only checks `isBorrower || isOwner`, not the current status. | Add `if (booking.status === "COMPLETED" || booking.status === "CANCELLED") return;`. |
| MEDIUM | `Dockerfile:15` | **Build-time `SESSION_SECRET` is a fixed string** `build-time-only-not-used-at-runtime-0000000000000000`. It passes the prod guard (32+ chars, not a placeholder pattern), but if the build ever accidentally uses it at runtime, all sessions are signed with a known key. The comment says it's throwaway, but it's a risk if `NODE_ENV=production` leaks into the build stage. | Use a random per-build secret: `ENV SESSION_SECRET=$(openssl rand -hex 32)` in a RUN step, or better, ensure the build stage never sets `NODE_ENV=production`. |
| MEDIUM | `src/lib/rate-limit.ts:63-73` | **`clientIp()` trusts `cf-connecting-ip` and the first `x-forwarded-for`.** Behind Caddy this is fine (Caddy overwrites XFF), but if the app is exposed directly or behind a different proxy that doesn't overwrite XFF, an attacker can spoof their IP to bypass rate limits. | Make trusted-proxy detection configurable. Only honor XFF from known proxy IPs, or rely solely on Caddy's overwrite and ignore XFF otherwise. |
| MEDIUM | `src/app/dashboard/collection/actions.ts:14-43` | **No input validation on `createVehicle`.** `year` is parsed with `parseInt` and checked `!= null`, but no range check (a user could set `year = -99999` or `year = 99999`). `imageUrl` is stored as-is with no https/URL validation (unlike the club logo path). | Add bounds: `year >= 1886 && year <= currentYear + 1`. Validate `imageUrl` is an https URL or null (same `httpsUrlOrNull` helper from sharing/actions.ts). |
| MEDIUM | `src/app/dashboard/collection/[id]/detail-actions.ts:15-30` | **`addExpense` validates `amount` is finite but doesn't bound it.** A user could submit `amount = -1e18` or `amount = 1e18`. `name`/`category`/`type` are unvalidated strings stored directly. | Clamp amount to `[0, 1_000_000]`. Validate category against `EXPENSE_CATEGORIES`. |
| MEDIUM | `src/app/dashboard/collection/[id]/detail-actions.ts:59-74` | **`addTimelineEvent` — `year` is `parseInt` with no range check, `category` is unvalidated** (should be one of `SERVICE|RESTORATION|ADMIN|HISTORY`). | Validate `category` against `TimelineCategory` and bound `year`. |
| MEDIUM | `src/app/dashboard/sharing/actions.ts:96-125` | **`requestBooking` date validation is weak.** `new Date(endDate) < new Date(startDate)` parses arbitrary strings; `startDate`/`endDate` are stored as TEXT. No format enforcement (a user could submit `startDate = "; DROP TABLE"` — though parameterized, it'd just be a weird string). No check that dates are in the future or within a reasonable range. | Validate with a strict `YYYY-MM-DD` regex and `Date` range checks. |
| LOW | `src/lib/session.ts:68` | **Session payload has no expiry field.** `iat` (issued-at) is stored but `getSessionUserId` never checks it. A stolen cookie is valid for 30 days with no server-side revocation. There's no session table. | For a hobby app this is acceptable. For production, add a server-side session store or at least check `iat` age and rotate. |
| LOW | `src/lib/session.ts:56-57` | **`crypto.timingSafeEqual` is called only after a length check** (`sig.length !== expected.length → null`). The length check itself leaks whether the signature length matches. In practice the expected length is constant (base64url of 32 bytes), so this is fine, but the comment says "constant-time" which is slightly misleading. | Acceptable; the length is fixed for HMAC-SHA256. |
| LOW | `src/lib/auth.ts:11-13` | **`hashPassword` uses bcrypt cost 10.** Acceptable but OWASP recommends 12+ for 2024+. | Bump to 12 if CPU budget allows. |

---

## 4. Code Quality — Grade: B

### Strengths
- **Strict TypeScript** (`tsconfig.json:7` `"strict": true`). No `any` in the type definitions.
- **Consistent naming.** Repo namespaces are plural (`Users`, `Vehicles`); actions are verb-prefixed (`createVehicle`, `addExpense`, `requestBooking`); client components are descriptive (`AddCarButton`, `EditProfileButton`, `DecisionButtons`).
- **Error boundaries** at both app (`error.tsx`) and global (`global-error.tsx`) levels with a reset button and digest logging.
- **`prefers-reduced-motion`** is respected in `globals.css:69-77`.
- **Consistent use of `revalidatePath`** after mutations — every Server Action that changes data calls it.
- **Good comments where non-obvious.** `session.ts:11-13` (COOKIE_SECURE rationale), `middleware.ts:13-17` (HSTS condition), `next.config.js:5-9` (serverExternalPackages), `group-access.ts:2-5` (why it's pure).

### Issues

| Sev | File | Issue | Fix |
|---|---|---|---|
| HIGH | No `.eslintrc` or `eslint.config.mjs` found | **No ESLint config.** `npm run lint` runs `next lint` which uses Next's defaults, but there's no project-level config to enforce rules. `eslint-disable-next-line @next/next/no-img-element` comments exist, suggesting lint runs, but there's no shared config for the team. | Add `eslint.config.mjs` extending `next/core-web-vitals` and `next/typescript` with strict rules. |
| MEDIUM | `src/lib/repo.ts:193` | **`as unknown as any[]`** cast on `Shares.forClub` return — type safety is abandoned here. | Define `SharedVehicleRow` and use it. |
| MEDIUM | `src/app/dashboard/sharing/actions.ts:190` | **`as any` cast** on `Handovers.upsert` data — the `Partial<HandoverLog>` type doesn't match the conditional `data` object shape. | Define a proper `HandoverInput` discriminated union type. |
| MEDIUM | `src/lib/db.ts:105,112,118` | **`(sql.unsafe as any)(...)`** — casting `sql.unsafe` to `any` to call it with a string + array (postgres.js's `unsafe` signature). This bypasses type checking entirely. | Use postgres.js's typed `sql.unsafe(text, params)` directly without `as any`. |
| MEDIUM | `CLAUDE.md` (entire) | **Stale documentation.** Describes `node:sqlite`, `DATA_DIR`, `sqlite.d.ts`, `npm run seed wipes ./data/app.db`. None of this is true anymore. The `scripts/schema.sql` instruction is still correct but the SQLite context is wrong. | Rewrite CLAUDE.md for Postgres/Supabase. |
| MEDIUM | `src/lib/constants.ts:27` | **Dead color token.** `PURCHASE: "#7c5cff"` — the CLAUDE.md mentions a "dead `accent: #7c5cff` token" but this is a different occurrence in `CATEGORY_COLORS`. The `#7c5cff` purple is used in the donut chart but `tailwind.config.ts` no longer has it as a Tailwind color. Inconsistent palette. | Either add `accent: { DEFAULT: "#dc2626", ... }` consistently (already done) and update `CATEGORY_COLORS` to use the `ink` scale or `accent` for PURCHASE. The `CarHeader.tsx:14` uses `bg-violet-500` for CLUB visibility dot while `CollectionGrid.tsx:29` uses `bg-accent` — inconsistent. |
| LOW | `src/app/dashboard/collection/[id]/profile/page.tsx:41` | **`JSON.parse(v.keyFacts)` with no try/catch.** If `keyFacts` is malformed (manually edited DB, migration artifact), this throws and the whole profile page 500s. | Wrap in try/catch, default to `[]`. |
| LOW | `src/lib/repo.ts:130-132` | **`code()` uses `Math.random()`** for invite codes. Not cryptographically random, but invite codes are not security-sensitive (they're 6-char uppercase, guessable by design for usability). | Acceptable; document that invite codes are not secrets. |
| LOW | `src/app/dashboard/collection/page.tsx:6-9` | **`firstName` returns the last word of the name** (last name), not the first. The function is named `firstName` but used as a greeting ("Hello, {firstName}"). Confusing — it shows the last name. | Rename to `lastName` or fix the logic to `parts[0]`. |
| LOW | `src/components/VehicleImage.tsx:23` | **`eslint-disable-next-line @next/next/no-img-element`** — intentionally using `<img>` instead of `next/image`. Documented in CLAUDE.md as deliberate (no upload pipeline). Acceptable but worth a `// TODO: switch to next/image when upload pipeline lands`. |

---

## 5. Performance — Grade: C+

### Strengths
- **Lazy DB singleton** (`db.ts:18-43`) — connection is opened on first query, not at import, so Next's build workers don't open a connection during static analysis. Good for build times and connection pool hygiene.
- **`serverExternalPackages: ["postgres", "bcryptjs"]`** (`next.config.js:9`) — keeps these out of the Next compiler bundle, avoiding broken dynamic `require()` in standalone output.
- **`output: "standalone"`** (`next.config.js:4`) — produces a minimal self-contained server bundle for Docker.
- **`Promise.all` for parallel independent queries** is used in `collection/page.tsx:15` and `expense-manager/page.tsx:48` (though these are N+1 patterns, at least they're parallel).
- **Client-side filtering/sorting** in `CollectionGrid.tsx:45-64` avoids re-fetching when the user changes the search/filter/sort.

### Issues

| Sev | File | Issue | Fix |
|---|---|---|---|
| HIGH | `src/app/dashboard/collection/page.tsx:15-23` | **N+1: one `shareCount` query per vehicle.** Described in Data Layer. | Single aggregate query. |
| HIGH | `src/app/dashboard/expense-manager/page.tsx:48-49` | **N+1: one `categoryTotals` query per vehicle.** | Single grouped query with `vehicleId` in the GROUP BY. |
| MEDIUM | `src/app/dashboard/layout.tsx:17` | **`Clubs.forUser` runs on every dashboard page load** (layout is shared by all dashboard routes). It's a single query, but it runs for every navigation including the expense-manager and profile pages that don't use clubs. | Move the club list fetch to only the routes that need it (collection, sharing), or cache it. |
| MEDIUM | `src/app/dashboard/collection/[id]/layout.tsx:14` + tab pages | **Vehicle fetched twice per tab navigation** (once in layout, once in the tab page). Two `SELECT * FROM "Vehicle"` round-trips. | Pass the vehicle from layout to children via a shared fetch or accept the duplication (the second call is likely cheap with Postgres buffer cache). |
| MEDIUM | All pages | **No caching layer.** No `unstable_cache`, no `revalidateTag`, no `fetch` with cache options. Every page render hits the DB. `revalidatePath` is called after mutations (good) but there's no read caching. | Add `unstable_cache` around expensive aggregate queries (expense totals, timeline stats). Use `revalidateTag` for granular invalidation. |
| MEDIUM | `src/components/VehicleImage.tsx:24-31` | **Plain `<img>` instead of `next/image`.** No lazy-loading, no responsive sizing, no format negotiation. Vehicle images are 1200px Unsplash photos loaded at full resolution even for 40px thumbnails. | Add `loading="lazy"` and `sizes` attributes at minimum, or migrate to `next/image` with the `remotePatterns` already configured in `next.config.js:14-18`. |
| MEDIUM | `src/app/g/[slug]/layout.tsx:25` + every page under `g/[slug]` | **`requireGroupMember` is called in the layout AND likely re-called in child pages.** The layout comment (line 23-24) explicitly warns that child pages must re-call it. This means 2-3 DB queries (club by slug, membership check) per group page load, duplicated. | The layout fetches and the child re-validates — this is defense-in-depth but costs 2x queries. Consider a shared cache or pass the resolved context down. |
| LOW | `src/lib/db.ts:31-36` | **`max: 10` connections.** Fine for a single VPS. Supabase's free tier allows up to 60 direct connections or 200 pooler connections. 10 is conservative but safe. | Acceptable. |
| LOW | `tailwind.config.ts:4` | **`content: ["./src/**/*.{ts,tsx}"]`** — correct purge scope. No unused CSS concern. | Good. |

---

## 6. Testing — Grade: D

### Strengths
- **No test framework dependency** — uses Node's built-in `node --test` with `node:test` and `node:assert/strict`. Zero install overhead.
- **Pure-function tests are well isolated.** `slug.test.ts` and `group-access.test.ts` test pure logic without any DB or Next dependency. `group-access.test.ts` uses `as Club` / `as ClubMembership` casts to construct fixtures — clean.
- **ESM loader hook** (`tests/loader.mjs`, `tests/register.mjs`) for extensionless `.ts` imports is a clever, minimal solution.
- **Test helper** (`tests/helpers/testdb.ts`) creates a temp directory and sets `DATA_DIR` — the right pattern for DB isolation (in the SQLite era).

### Issues

| Sev | File | Issue | Fix |
|---|---|---|---|
| CRITICAL | `tests/helpers/testdb.ts:7` | **Sets `DATA_DIR` but `db.ts` now ignores `DATA_DIR` and requires `DATABASE_URL`.** Every test that imports `./helpers/testdb` and then uses repo functions will throw `DATABASE_URL is not set` (`db.ts:22-25`). **The entire repo-integration test suite is broken and cannot run.** | Rewrite the test harness to spin up a Postgres instance (e.g. via `pgdocker`/`testcontainers` or connect to a `DATABASE_URL` test DB). Set `process.env.DATABASE_URL` to a test Postgres. Clean tables between tests via `TRUNCATE`. |
| CRITICAL | `tests/migration.test.ts:6,13` | **Imports `node:sqlite` and creates a `DatabaseSync`.** This test is entirely SQLite-based and cannot work with the Postgres migration. It will fail on import. | Delete or rewrite for Postgres migration testing (run old DDL, then new DDL, verify backfill). |
| CRITICAL | `tests/repo-clubs.test.ts`, `tests/isolation.test.ts`, `tests/harness.test.ts`, `tests/group-access.test.ts` | **4 of 6 test files import `./helpers/testdb`** and will all fail at the DB layer. Only `slug.test.ts` and `group-access.test.ts` (pure logic) can pass. | Fix the test harness first, then these tests work. |
| HIGH | `tests/` (all) | **No tests for Server Actions, auth, rate limiting, session, or security-critical paths.** Zero coverage of: `loginAction`, `registerAction`, `requestBooking`, `decideBooking`, `saveHandover`, session sign/unsign, rate limit check/reset, CSP middleware, input validation. | Add tests for: session sign/unsign round-trip, rate limit check/reset, booking overlap logic, state machine transitions (decideBooking should reject non-PENDING), input validation (year bounds, hex color, https URL). |
| HIGH | `tests/` (all) | **No integration tests for the booking/sharing domain rules** documented in CLAUDE.md (double-booking prevention, OWNER removal prevention, bookable-by logic). The `isolation.test.ts` tests the bookable logic at the repo level but is broken by the DB harness issue. | Once the harness is fixed, these tests are valuable — ensure they cover the action-layer guards too, not just repo. |
| MEDIUM | `tests/isolation.test.ts:4,16` | **`Memberships.add(groupB.id, bob.id, "MEMBER")` comment says "already owner, no-op safety"** — but bob owns groupB, so `add` checks `Memberships.of` first (returns existing) and returns early. The test is correct but the comment is misleading. | Fix comment. |
| MEDIUM | `package.json:14` | **Test script globs `tests/**/*.test.ts`** — the `tests/helpers/testdb.ts` file is `.ts` but not `.test.ts` so it won't be picked up as a test. Good. But `tests/loader.mjs` and `tests/register.mjs` are `.mjs` — also excluded. The glob is correct. | No action needed. |
| LOW | `tests/slug.test.ts:17-22` | **`uniqueSlug` test uses a sync `exists` function** — the real `Clubs.slugExists` is async. The function supports both, but the test only exercises the sync path. | Add an async `exists` test case. |

---

## 7. Deploy/DevOps — Grade: B+

### Strengths
- **Multi-stage Dockerfile** (`Dockerfile:1-37`) with `deps → build → run` stages. Uses `node:22-slim` (not `alpine`, avoiding musl bcrypt issues). Copies only standalone output + static + scripts + the two `serverExternalPackages` node_modules. Minimal attack surface.
- **`.dockerignore`** (`excludes node_modules, .next, .git, .env, deploy, design-system, docs`) — prevents leaking secrets and bloat into the build context.
- **Caddy with automatic HTTPS** (`Caddyfile:1-24`). `{$DOMAIN}` templating, `encode zstd gzip`, `header_up X-Forwarded-For {remote_host}` (overwrites, preventing spoofing), `ACME_EMAIL` for Let's Encrypt notices.
- **`docker-compose.yml`** is clean: `restart: unless-stopped`, `env_file: .env`, no volumes for the app (DB is in Supabase), Caddy data/config volumes for cert persistence, `depends_on: app`.
- **Healthcheck** (`docker-compose.yml:21-25`) uses `node -e "fetch('http://127.0.0.1:3000/healthz')..."` — smart for `node:22-slim` which lacks curl/wget. `start_period: 20s`, 3 retries, 30s interval.
- **`healthz` route** (`src/app/healthz/route.ts:1-5`) with `export const dynamic = "force-dynamic"` — ensures it's not statically cached and always reflects liveness. Excluded from middleware CSP via the matcher pattern.
- **`.env.example` files** for both root (dev) and deploy (compose) with clear comments and `openssl rand -hex 32` instructions.
- **Build-time placeholder env vars** (`Dockerfile:15-18`) prevent the session module's prod guard from crashing the build, with clear comments that they're throwaway.

### Issues

| Sev | File | Issue | Fix |
|---|---|---|---|
| HIGH | `docker-compose.yml:16-17` | **"Run exactly ONE replica"** is a hard constraint due to the in-process rate limiter. This is documented but not enforced. If someone scales `replicas: 2`, rate limits silently weaken and the DB singleton multiplies connections. | Either document loudly in the compose file with a comment, or switch to a shared rate-limit store before allowing scaling. |
| MEDIUM | `Dockerfile:22-37` | **No graceful shutdown.** `CMD ["node", "server.js"]` — Next's standalone server handles SIGTERM, but there's no `STOPSIGNAL` or healthcheck-based pre-stop hook. In-flight requests may be killed during deploy. | Add `STOPSIGNAL SIGTERM` (default) and ensure the healthcheck endpoint returns unhealthy during shutdown. Consider a `preStop` hook if using Kubernetes. |
| MEDIUM | `docker-compose.yml:33-34` | **Host ports 8080:80 and 8443:443.** The Caddyfile comment explains this is for local testing; production should use 80/443. But the compose file ships with 8080/8443, so a production deploy would serve on non-standard ports unless edited. | Make the port mapping configurable via env, or document the required edit prominently. |
| MEDIUM | `deploy/.env.example:19` | **`DOMAIN=cars.example.com`** is a placeholder that will cause Caddy to attempt ACME for `cars.example.com` if not edited. No guard. | Add a check in Caddyfile or compose that refuses to start if `DOMAIN` is still `cars.example.com` or `:80`. |
| MEDIUM | `Dockerfile:34-35` | **Copies `postgres` and `bcryptjs` from full `node_modules`.** If these packages gain transitive deps in a future version, the copy may be incomplete. | Use `npm prune --production` in the build stage and copy `node_modules` wholesale, or pin the versions and document the manual copy as fragile. Better: use `next.config.js` `outputFileTracingIncludes` to let Next trace these deps automatically. |
| LOW | `Dockerfile:2,8,22` | **No `--platform` or arch flag.** Built on whatever the build host is. Fine for a single-VPS deploy but will fail on multi-arch (ARM/AMD) without `--platform`. | Add `--platform=$BUILDPLATFORM` / `--platform=linux/amd64` if cross-building. |
| LOW | `docker-compose.yml:22` | **Healthcheck `fetch` doesn't check status code.** `r.ok` is true for any 2xx, which is correct for `/healthz` returning `{ok: true}` with 200. If the route were to return 500, `r.ok` is false → process exits 1 → unhealthy. Correct. | No action needed. |
| LOW | `Dockerfile:30` | **`COPY --from=build /app/scripts ./scripts`** — copies the schema SQL for runtime auto-migration. This means the schema is baked into the image. If you need to migrate an existing DB without redeploying, there's no separate migration command. | Add a `npm run migrate` script that runs the DDL, and document running it as a one-off `docker compose exec app node -e "..."`. |

---

## 8. Design System — Grade: B-

### Strengths
- **Tailwind config is clean and intentional** (`tailwind.config.ts`). `ink` color scale (slate-based), `accent` (action red `#dc2626`), custom `font-display` (Playfair) and `font-sans` (Inter), custom `boxShadow.card`/`lift`, `letterSpacing.eyebrow`, `rise` keyframe/animation. Not bloated.
- **Fonts are properly loaded** (`layout.tsx:5-18`): `Inter` + `Playfair_Display` via `next/font/google` with `variable` + `display: "swap"`. The CSS variables `--font-sans` / `--font-display` are wired into Tailwind's `fontFamily`.
- **Component classes in `globals.css`** (`card`, `btn-primary`, `btn-accent`, `btn-ghost`, `input`, `label`, `pill`, `eyebrow`, `h-display`, `stat-card`) — good abstraction, consistent usage across pages.
- **`prefers-reduced-motion`** is respected (`globals.css:69-77`).
- **Responsive design.** `md:` and `sm:` breakpoints used throughout. `BottomNav` (mobile) vs `TopNav` (desktop) via `md:hidden` / `hidden md:block`. `safe-area-inset-bottom` for iPhone notch. Grid layouts use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- **`viewport` export** (`layout.tsx:27-31`) with `width: device-width`, `initialScale: 1`, `themeColor`. Correct Next 14 metadata API.
- **Group theming** (`g/[slug]/layout.tsx:6-12`) sets `--group-accent` CSS variables from the club's `primaryColor`, and `btn-accent` uses them (`globals.css:40-46`). Clean per-group branding.

### Issues

| Sev | File | Issue | Fix |
|---|---|---|---|
| HIGH | `src/components/Modal.tsx:26-39` | **Modal has no focus trap and no `role="dialog"`/`aria-modal`.** When the modal opens, focus doesn't move to it, and Tab can reach elements behind the overlay. Screen readers won't announce it as a dialog. The Escape handler exists (`Modal.tsx:17-21`) which is good, but that's it. | Add `role="dialog" aria-modal="true" aria-labelledby`. Trap focus with a focus-trap library or manual first/last element management. Move focus to the modal on open, restore to trigger on close. |
| HIGH | `src/app/dashboard/collection/[id]/CarHeader.tsx:53-66` | **Visibility dropdown has no ARIA semantics.** It's a `<button>` that toggles a `<div>` menu, but there's no `role="menu"`, `aria-haspopup`, `aria-expanded`, or keyboard navigation (arrow keys). Click-outside-to-close is not implemented (only the GroupSwitcher has it). | Add ARIA menu roles, `aria-expanded` on the trigger, click-outside handler, and arrow-key navigation. Or use Radix UI's `Menu` primitive. |
| MEDIUM | `src/components/VehicleImage.tsx` | **No `loading="lazy"`** on any `<img>`. All vehicle/gallery images load eagerly. For a gallery page with many images, this is a performance and accessibility issue. | Add `loading="lazy"` and appropriate `width`/`height` to prevent layout shift. |
| MEDIUM | `src/app/dashboard/collection/[id]/CarHeader.tsx:42` | **`ChevronLeft` link has no `aria-label`.** The back link (`←`) is a `<Link>` containing only an SVG icon with no accessible name. | Add `aria-label="Back to collection"`. |
| MEDIUM | `src/components/DeleteButton.tsx:33-35` | **Trash icon button has no `aria-label`.** It's icon-only. | Add `aria-label="Delete"` (or accept a `label` prop, which exists but isn't required). |
| MEDIUM | `src/app/dashboard/collection/[id]/profile/EditProfile.tsx:22` | **Edit button has `aria-label="Edit specs"`** — good. But the "Enhance Image" button (`EditProfile.tsx:94-101`) has no accessible name beyond its visible text, which is fine. The "Change Image" button (`EditProfile.tsx:91`) also has visible text. OK. | No action needed for these. |
| MEDIUM | `tailwind.config.ts:22-28` + `src/lib/constants.ts:27` + `CarHeader.tsx:14` | **Inconsistent accent color usage.** `tailwind.config.ts` defines `accent: #dc2626` (action red). But `CATEGORY_COLORS.PURCHASE = "#7c5cff"` (purple) — a dead palette remnant. `CarHeader.tsx:14` uses `bg-violet-500` for the CLUB visibility dot, while `CollectionGrid.tsx:29` uses `bg-accent` for the same CLUB state. The CLUB state is represented by three different colors across the app. | Pick one color for CLUB visibility and use it everywhere. Remove `#7c5cff` from constants or align it. |
| MEDIUM | `src/app/(auth)/login/page.tsx:25` | **"Forgot your password?" link is `href="#"`** — a dead link. No password reset flow exists. | Either remove the link or implement a reset flow. A dead `#` link is worse than absence. |
| MEDIUM | `globals.css` | **No `:focus-visible` styles.** The `.input` has `focus:ring` but interactive elements (buttons, links) rely on the browser default focus ring, which is often invisible on the dark backgrounds used. | Add a global `:focus-visible { outline: 2px solid theme(colors.accent.DEFAULT); outline-offset: 2px; }` or per-component focus styles. |
| LOW | `src/app/globals.css:8` | **`background: #f8fafc`** (off-white) on `html,body` but `dashboard/layout.tsx:19` sets `bg-white` on the wrapper. The off-white shows on overscroll. Intentional per the comment. | Acceptable. |
| LOW | `tailwind.config.ts:34-37` | **Custom `borderRadius`** (`xl: 0.875rem`, `2xl: 1.125rem`) slightly differs from Tailwind defaults (`0.75rem`, `1rem`). Intentional per design system. | Fine. |

---

## Summary Table of All Issues

| # | Sev | Dimension | File | Description |
|---|---|---|---|---|
| 1 | CRITICAL | Data | `db.ts:45-61` / `seed.mjs:26-29` | Split-brain migration: app and seed independently parse schema.sql with a fragile `;`-splitter |
| 2 | CRITICAL | Testing | `tests/helpers/testdb.ts:7` | Sets `DATA_DIR` but db.ts requires `DATABASE_URL`; entire integration test suite is broken |
| 3 | CRITICAL | Testing | `tests/migration.test.ts:6,13` | Imports `node:sqlite`; incompatible with Postgres migration |
| 4 | HIGH | Arch | `db.ts:39` | `void migrate(sql)` is fire-and-forget; first query may hit a partially-migrated schema |
| 5 | HIGH | Arch | `CLAUDE.md` / `sqlite.d.ts` | Stale SQLite docs + dead `sqlite.d.ts` type declaration |
| 6 | HIGH | Data | `db.ts:51-57` | Naive DDL splitter breaks on semicolons in strings/functions |
| 7 | HIGH | Data | `schema.sql:51,143` | `Expense.date`, `Booking.startDate/endDate`, `HandoverLog.updatedAt` are TEXT not TIMESTAMPTZ |
| 8 | HIGH | Data | `sharing/actions.ts:110-121` | Booking overlap check + insert is a TOCTOU race; no transaction or exclusion constraint |
| 9 | HIGH | Data | `sharing/actions.ts:66-81` | Share + visibility flip is non-atomic (two separate queries, no transaction) |
| 10 | HIGH | Perf | `collection/page.tsx:15-23` | N+1: one `shareCount` query per vehicle |
| 11 | HIGH | Perf | `expense-manager/page.tsx:48-49` | N+1: one `categoryTotals` query per vehicle |
| 12 | HIGH | Sec | `actions.ts` (all) | No explicit CSRF beyond `sameSite: lax` (relies on Next 14.2 built-in) |
| 13 | HIGH | Sec | `rate-limit.ts:1-2` | In-process limiter; single-replica only; breaks on horizontal scale |
| 14 | HIGH | Sec | `sharing/actions.ts:127-136` | `decideBooking` allows status transitions from any state (no state machine) |
| 15 | HIGH | Quality | No `.eslintrc` | No ESLint config; relies on `next lint` defaults |
| 16 | HIGH | Testing | `tests/` (all) | No tests for actions, auth, rate-limit, session, security paths |
| 17 | HIGH | Testing | `tests/` (all) | No integration tests for booking domain rules at action layer |
| 18 | HIGH | Design | `Modal.tsx:26-39` | No focus trap, no ARIA dialog roles; screen reader inaccessible |
| 19 | HIGH | Design | `CarHeader.tsx:53-66` | Visibility dropdown lacks ARIA menu semantics and keyboard nav |
| 20 | MEDIUM | Arch | `prisma/schema.prisma` | Dead Prisma schema (SQLite) contradicts live Postgres schema |
| 21 | MEDIUM | Arch | `[id]/layout.tsx:14` + tab pages | Double auth guard: vehicle fetched twice per tab navigation |
| 22 | MEDIUM | Arch | `db.ts:88-119` | SQLite-style `get/all/run` helpers layered over Postgres via `sql.unsafe` |
| 23 | MEDIUM | Data | `repo.ts:190-193` | `as unknown as any[]` cast abandons type safety on `Shares.forClub` |
| 24 | MEDIUM | Data | `repo.ts:260-280` | `Handovers.upsert` is read-then-write TOCTOU; should use `ON CONFLICT` |
| 25 | MEDIUM | Data | `repo.ts:59` | `(await get(...))!.c` non-null assertion instead of `?.c ?? 0` |
| 26 | MEDIUM | Data | `db.ts:30` | Supabase pooler detection by URL regex is brittle |
| 27 | MEDIUM | Sec | `Dockerfile:15` | Build-time `SESSION_SECRET` is a fixed string (low entropy risk if leaked to runtime) |
| 28 | MEDIUM | Sec | `rate-limit.ts:63-73` | `clientIp()` trusts `x-forwarded-for` unconditionally |
| 29 | MEDIUM | Sec | `collection/actions.ts:14-43` | No input validation on `createVehicle` (year bounds, imageUrl https check) |
| 30 | MEDIUM | Sec | `detail-actions.ts:15-30` | `addExpense` doesn't bound amount or validate category |
| 31 | MEDIUM | Sec | `detail-actions.ts:59-74` | `addTimelineEvent` doesn't validate year range or category enum |
| 32 | MEDIUM | Sec | `sharing/actions.ts:96-125` | `requestBooking` date validation is weak (no format/range enforcement) |
| 33 | MEDIUM | Sec | `sharing/actions.ts:138-148` | `cancelBooking` allows cancelling COMPLETED/CANCELLED bookings |
| 34 | MEDIUM | Quality | `repo.ts:193`, `actions.ts:190`, `db.ts:105` | `as any` / `as unknown as any[]` casts bypass type checking |
| 35 | MEDIUM | Quality | `CLAUDE.md` | Entirely stale (describes SQLite, not Postgres) |
| 36 | MEDIUM | Quality | `constants.ts:27` | Dead `#7c5cff` purple token in `CATEGORY_COLORS` |
| 37 | MEDIUM | Perf | `dashboard/layout.tsx:17` | `Clubs.forUser` runs on every dashboard page (including unrelated routes) |
| 38 | MEDIUM | Perf | All pages | No caching layer (`unstable_cache`/`revalidateTag`) |
| 39 | MEDIUM | Perf | `VehicleImage.tsx:24-31` | Plain `<img>`, no lazy-loading, no responsive sizing |
| 40 | MEDIUM | Perf | `g/[slug]/layout.tsx:25` | `requireGroupMember` called in layout AND re-called in child pages (2x queries) |
| 41 | MEDIUM | Deploy | `docker-compose.yml:16` | "ONE replica" constraint not enforced; rate limiter breaks on scale |
| 42 | MEDIUM | Deploy | `Dockerfile:22-37` | No graceful shutdown / STOPSIGNAL handling |
| 43 | MEDIUM | Deploy | `docker-compose.yml:33-34` | Host ports 8080/8443 (non-standard); production edit required |
| 44 | MEDIUM | Deploy | `deploy/.env.example:19` | `DOMAIN=cars.example.com` placeholder with no guard |
| 45 | MEDIUM | Deploy | `Dockerfile:34-35` | Manual `COPY` of `postgres`/`bcryptjs` node_modules is fragile |
| 46 | MEDIUM | Design | `VehicleImage.tsx` | No `loading="lazy"` on images |
| 47 | MEDIUM | Design | `CarHeader.tsx:42` | `ChevronLeft` back link has no `aria-label` |
| 48 | MEDIUM | Design | `DeleteButton.tsx:33-35` | Icon-only delete button missing `aria-label` by default |
| 49 | MEDIUM | Design | `tailwind.config.ts` + `constants.ts` + `CarHeader.tsx` | CLUB visibility state uses 3 different colors across the app |
| 50 | MEDIUM | Design | `login/page.tsx:25` | "Forgot password?" is a dead `href="#"` link |
| 51 | MEDIUM | Design | `globals.css` | No `:focus-visible` styles for keyboard navigation |
| 52 | LOW | Arch | `page.tsx:4-6` | `Home()` is sync while the rest uses `await requireUser()` |
| 53 | LOW | Data | `db.ts:16` | `globalThis` singleton assumes long-running process |
| 54 | LOW | Data | `schema.sql:99` | `Club.slug` nullable but `uniqueSlug` always assigns; could be `NOT NULL` |
| 55 | LOW | Sec | `session.ts:68` | No session expiry check; stolen cookie valid for 30 days |
| 56 | LOW | Sec | `auth.ts:12` | bcrypt cost 10 (OWASP recommends 12+) |
| 57 | LOW | Quality | `profile/page.tsx:41` | `JSON.parse(v.keyFacts)` with no try/catch |
| 58 | LOW | Quality | `repo.ts:130-132` | `Math.random()` for invite codes (not crypto-secure) |
| 59 | LOW | Quality | `collection/page.tsx:6-9` | `firstName` function returns the last name |
| 60 | LOW | Deploy | `Dockerfile:2,8,22` | No `--platform` flag for multi-arch builds |
| 61 | LOW | Deploy | `Dockerfile:30` | Schema baked into image; no standalone migration command |
| 62 | LOW | Testing | `slug.test.ts:17-22` | `uniqueSlug` test only covers sync `exists` path |
| 63 | LOW | Design | `globals.css:8` | Off-white `#f8fafc` vs `bg-white` wrapper (intentional, documented) |

---

## Top 5 Fixes (Priority Order)

1. **Fix the test harness** (#2, #3) — the entire integration test suite is broken. Set up a Postgres test DB, rewrite `testdb.ts`, delete or rewrite `migration.test.ts`. Without tests, every other fix is unsafe.

2. **Add transactions to booking + sharing mutations** (#8, #9, #24) — `requestBooking`, `shareVehicle`, `unshareVehicle`, and `Handovers.upsert` all have TOCTOU races. Wrap in `sql.begin()` or use `ON CONFLICT`.

3. **Fix the migration runner** (#1, #4, #6) — `void migrate(sql)` is fire-and-forget and the `;`-splitter is fragile. Await migration before serving queries and use a proper multi-statement executor.

4. **Add input validation to all Server Actions** (#29-33) — `createVehicle`, `addExpense`, `addTimelineEvent`, `requestBooking` all accept unvalidated user input. Add bounds checks, enum validation, and URL validation.

5. **Fix accessibility in Modal and CarHeader dropdown** (#18, #19) — add ARIA dialog roles + focus trap to Modal; add ARIA menu semantics + keyboard nav to the visibility dropdown.

---

*Audit complete. Every key file was read in full. This report is based on actual file contents as of 2026-06-19.*