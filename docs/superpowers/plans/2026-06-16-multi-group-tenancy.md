# Multi-Group (Path-Based Tenancy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the app so up to ~20 car-share groups (≤20 users each) run on one deployment and one SQLite database, each group reachable at its own path-based URL (`/g/<slug>`) with its own branding, while one user account can belong to many groups — with code-enforced data isolation between groups.

**Architecture:** The existing `Club` entity is promoted to the "group". We add a URL `slug` plus branding columns to `Club`, introduce a `/g/[slug]` route segment that resolves and authorizes the group on every request, re-skin the accent color per group via CSS variables, and audit every club-scoped query so a non-member can never read or act on another group's data. The user's private garage (`/dashboard/collection`) stays global and follows them across groups. No multi-tenant database split — one shared SQLite file, isolation enforced in code.

**Tech Stack:** Next.js 14 (App Router, Server Components + Server Actions), TypeScript 5.5, Tailwind 3.4, Node 22.5+ built-in `node:sqlite`, `node --test` for tests (Node 24 native TS type-stripping — no test framework dep).

---

## Conventions used in this plan

- Path alias `@/*` → `src/*` (already configured in `tsconfig.json`).
- The data layer is **`node:sqlite` via `src/lib/repo.ts`**, NOT Prisma. `prisma/schema.prisma` is a historical reference only — do not wire it.
- **Schema lives in two places that must stay in sync:** `src/lib/db.ts` (`migrate()`, runtime `CREATE TABLE`) and `scripts/schema.sql` (used by `npm run seed`). Every schema change in this plan edits BOTH.
- "Group" (user-facing term) == `Club` (code/table name). We keep the table name `Club` to avoid a destructive rename; the UI says "group".
- A group's canonical URL is `/g/<slug>`. The legacy `/dashboard/sharing/<clubId>` URL is redirected to it.

## File Structure (what gets created / modified)

**Created:**
- `src/lib/slug.ts` — pure slug helpers (`slugify`, `uniqueSlug`). No deps. Testable.
- `src/lib/group.ts` — `checkGroupAccess` (pure, testable) + `requireGroupMember` (Next glue).
- `src/app/g/[slug]/layout.tsx` — per-group auth gate + branding wrapper + group nav.
- `src/app/g/[slug]/page.tsx` — group home (members + cars), migrated from the legacy club page.
- `src/app/g/[slug]/not-found.tsx` — friendly "group not found / not a member" page.
- `src/components/GroupSwitcher.tsx` — dropdown of the groups you belong to.
- `tests/helpers/testdb.ts` — temp-DB harness for repo tests.
- `tests/slug.test.ts`, `tests/group-access.test.ts`, `tests/repo-clubs.test.ts`, `tests/isolation.test.ts` — tests.
- `Dockerfile`, `.dockerignore` — production container (Phase 6).
- `docs/PRODUCTION.md` — deploy + backup runbook (Phase 6).

**Modified:**
- `src/lib/types.ts` — extend `Club` interface with slug + branding fields.
- `src/lib/db.ts` — `ensureColumns` for `Club`, slug backfill, unique index.
- `src/lib/repo.ts` — `Clubs.bySlug`, `Clubs.slugExists`, options-based `Clubs.create`, slug in `forUser`.
- `scripts/schema.sql` — mirror new `Club` columns.
- `scripts/seed.mjs` — set `slug` (+ optional branding) on seeded clubs.
- `src/app/dashboard/sharing/actions.ts` — `createClub`/`joinClub`/`leaveClub` redirect to `/g/<slug>`; create accepts branding.
- `src/app/dashboard/sharing/page.tsx` — group cards link to `/g/<slug>`.
- `src/app/dashboard/sharing/[clubId]/page.tsx` — replaced by a redirect to the slug URL.
- `src/app/globals.css` — `.btn-accent` reads `--group-accent` CSS var.
- `src/app/dashboard/sharing/ClubButtons.tsx` — create-group form gains slug preview + branding inputs.
- `next.config.js` — `output: "standalone"` (Phase 6).
- `package.json` — `test` script.

---

## Phase 0 — Test harness (enables TDD for later phases)

### Task 0.1: Add a `node --test` script and a temp-DB helper

**Files:**
- Modify: `package.json`
- Create: `tests/helpers/testdb.ts`

- [ ] **Step 1: Add the test script**

In `package.json`, add to `"scripts"`:

```json
    "test": "node --test --import ./tests/helpers/register.ts"
```

Node 24 strips TypeScript types natively, but the test runner needs `.ts` discovery. Simpler: change the script to glob `.ts` test files directly:

```json
    "test": "node --test tests/**/*.test.ts"
```

(If your Node prints a type-stripping flag warning, use `node --test --experimental-strip-types tests/**/*.test.ts`.)

- [ ] **Step 2: Create the temp-DB helper**

Create `tests/helpers/testdb.ts`. It sets `DATA_DIR` to a unique temp directory **before** any `@/lib/db` import triggers the lazy connection, and exposes a reset. Because `node --test` runs each test file in its own process, each file gets an isolated database.

```ts
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Must run before src/lib/db.ts opens its lazy singleton (first query).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-test-"));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = "test";

export const TEST_DATA_DIR = dir;

export function cleanup(): void {
  fs.rmSync(dir, { recursive: true, force: true });
}
```

- [ ] **Step 3: Smoke-test the harness**

Create `tests/harness.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/testdb";
import { Users } from "../src/lib/repo";

test("temp DB is writable and isolated", () => {
  const u = Users.create({ name: "Harness", email: "h@example.com", passwordHash: "x" });
  assert.equal(Users.byId(u.id)?.email, "h@example.com");
});
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: 1 test passing. (If `node:sqlite` errors as unavailable, prefix with `NODE_OPTIONS=--experimental-sqlite`.)

- [ ] **Step 5: Commit**

```bash
git add package.json tests/helpers/testdb.ts tests/harness.test.ts
git commit -m "test: add node:test harness with isolated temp SQLite db"
```

---

## Phase 1 — Group model: slug + branding

### Task 1.1: Slug helpers (pure, TDD)

**Files:**
- Create: `src/lib/slug.ts`
- Test: `tests/slug.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, uniqueSlug } from "../src/lib/slug";

test("slugify lowercases and dashes non-alphanumerics", () => {
  assert.equal(slugify("Mountain  Drivers!"), "mountain-drivers");
});

test("slugify strips accents and trims dashes", () => {
  assert.equal(slugify("  Café Crüe  "), "cafe-crue");
});

test("slugify falls back to 'group' for empty input", () => {
  assert.equal(slugify("!!!"), "group");
});

test("uniqueSlug appends a counter when taken", () => {
  const taken = new Set(["mountain-drivers", "mountain-drivers-2"]);
  assert.equal(
    uniqueSlug("Mountain Drivers", (s) => taken.has(s)),
    "mountain-drivers-3",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/slug.test.ts` (or `node --test tests/slug.test.ts`)
Expected: FAIL — cannot find module `../src/lib/slug`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/slug.ts`:

```ts
const MAX_LEN = 40;

export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LEN)
    .replace(/-+$/g, "");
  return base || "group";
}

/**
 * Returns a slug derived from `name` that `exists` reports as free.
 * Appends -2, -3, ... on collision.
 */
export function uniqueSlug(name: string, exists: (slug: string) => boolean): string {
  const base = slugify(name);
  if (!exists(base)) return base;
  for (let i = 2; i < 10000; i++) {
    const candidate = `${base}-${i}`;
    if (!exists(candidate)) return candidate;
  }
  // Practically unreachable at <20 groups.
  return `${base}-${base.length}-x`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/slug.test.ts`
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts tests/slug.test.ts
git commit -m "feat: add slug helpers for group URLs"
```

### Task 1.2: Extend the `Club` type

**Files:**
- Modify: `src/lib/types.ts:87-94`

- [ ] **Step 1: Add fields to the `Club` interface**

Replace the existing `Club` interface with:

```ts
export interface Club {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  inviteCode: string;
  slug: string;
  primaryColor: string | null;   // hex, e.g. "#dc2626" — group accent CTA color
  accentColor: string | null;    // hex — optional secondary accent
  logoUrl: string | null;        // group logo (https URL)
  tagline: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Verify it typechecks (will fail until repo/db updated — expected)**

Run: `npx tsc --noEmit`
Expected: errors only in `repo.ts`/`db.ts` where `Club` rows are constructed without the new fields. These are fixed in Task 1.3–1.4. (Type-only change; no separate commit yet — commit with Task 1.3.)

### Task 1.3: Schema migration, backfill, and unique index in `db.ts`

**Files:**
- Modify: `src/lib/db.ts` (add import; extend `migrate()`; add `backfillClubSlugs`)

- [ ] **Step 1: Import the slug helper**

At the top of `src/lib/db.ts`, after the existing imports, add:

```ts
import { slugify } from "./slug";
```

- [ ] **Step 2: Add the new `Club` columns to the runtime `CREATE TABLE`**

In `migrate()`, update the `CREATE TABLE IF NOT EXISTS Club (...)` block to include the new columns (for fresh databases):

```sql
  CREATE TABLE IF NOT EXISTS Club (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    ownerId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
    inviteCode TEXT UNIQUE NOT NULL,
    slug TEXT,
    primaryColor TEXT,
    accentColor TEXT,
    logoUrl TEXT,
    tagline TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
```

- [ ] **Step 3: Add `ensureColumns` + backfill + unique index at the end of `migrate()`**

After the existing `ensureColumns(db, "TimelineEvent", {...})` call, add:

```ts
  ensureColumns(db, "Club", {
    slug: "TEXT",
    primaryColor: "TEXT",
    accentColor: "TEXT",
    logoUrl: "TEXT",
    tagline: "TEXT",
  });
  backfillClubSlugs(db);
  // Unique index (not a column constraint) so backfill can run first and so
  // SQLite tolerates pre-existing NULLs during the upgrade window.
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_club_slug ON Club(slug);");
```

- [ ] **Step 4: Implement `backfillClubSlugs`**

Add this function alongside `ensureColumns` in `db.ts`:

```ts
function backfillClubSlugs(db: DatabaseSync) {
  const rows = db
    .prepare("SELECT id, name FROM Club WHERE slug IS NULL OR slug = ''")
    .all() as { id: string; name: string }[];
  if (!rows.length) return;

  const taken = new Set(
    (db.prepare("SELECT slug FROM Club WHERE slug IS NOT NULL AND slug <> ''").all() as { slug: string }[])
      .map((r) => r.slug),
  );

  const update = db.prepare("UPDATE Club SET slug = ? WHERE id = ?");
  for (const r of rows) {
    const base = slugify(r.name);
    let candidate = base;
    let i = 2;
    while (taken.has(candidate)) candidate = `${base}-${i++}`;
    taken.add(candidate);
    update.run(candidate, r.id);
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `repo.ts` (Task 1.4). `db.ts` itself clean.

### Task 1.4: `Clubs` repo — `bySlug`, `slugExists`, options-based `create`, slug in `forUser`

**Files:**
- Modify: `src/lib/repo.ts:128-147`
- Test: `tests/repo-clubs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/repo-clubs.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/testdb";
import { Users, Clubs, Memberships } from "../src/lib/repo";

function mkUser(email: string) {
  return Users.create({ name: email.split("@")[0], email, passwordHash: "x" });
}

test("create assigns a unique slug derived from the name", () => {
  const owner = mkUser("o1@example.com");
  const a = Clubs.create(owner.id, "Mountain Drivers");
  const b = Clubs.create(owner.id, "Mountain Drivers");
  assert.equal(a.slug, "mountain-drivers");
  assert.equal(b.slug, "mountain-drivers-2");
});

test("bySlug round-trips and adds the owner as OWNER member", () => {
  const owner = mkUser("o2@example.com");
  const club = Clubs.create(owner.id, "Coastal Cruisers");
  assert.equal(Clubs.bySlug("coastal-cruisers")?.id, club.id);
  assert.equal(Memberships.of(club.id, owner.id)?.role, "OWNER");
});

test("create stores branding when provided", () => {
  const owner = mkUser("o3@example.com");
  const club = Clubs.create(owner.id, "Track Day Club", {
    description: "weekend track runs",
    primaryColor: "#1d4ed8",
    logoUrl: "https://example.com/logo.png",
  });
  const fetched = Clubs.bySlug(club.slug)!;
  assert.equal(fetched.primaryColor, "#1d4ed8");
  assert.equal(fetched.logoUrl, "https://example.com/logo.png");
  assert.equal(fetched.description, "weekend track runs");
});

test("forUser returns slug for the user's clubs", () => {
  const owner = mkUser("o4@example.com");
  Clubs.create(owner.id, "Roadsters United");
  const list = Clubs.forUser(owner.id);
  assert.ok(list.some((c) => c.slug === "roadsters-united"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/repo-clubs.test.ts`
Expected: FAIL — `Clubs.bySlug` is not a function / `create` signature mismatch.

- [ ] **Step 3: Implement the repo changes**

Replace the `Clubs` object (lines ~132-147) in `src/lib/repo.ts` with:

```ts
export const Clubs = {
  byId: (cid: string) => get<Club>("SELECT * FROM Club WHERE id=?", cid),
  bySlug: (slug: string) => get<Club>("SELECT * FROM Club WHERE slug=?", slug),
  byInvite: (c: string) => get<Club>("SELECT * FROM Club WHERE inviteCode=?", c),
  slugExists: (slug: string) => !!get<{ x: number }>("SELECT 1 x FROM Club WHERE slug=?", slug),
  forUser: (uid: string) =>
    all<Club & { memberCount: number; role: string }>(
      `SELECT c.*, m.role AS role,
        (SELECT COUNT(*) FROM ClubMembership mm WHERE mm.clubId = c.id) AS memberCount
       FROM Club c JOIN ClubMembership m ON m.clubId = c.id
       WHERE m.userId = ? ORDER BY c.createdAt DESC`, uid),
  create(
    ownerId: string,
    name: string,
    opts: {
      description?: string;
      slug?: string;
      primaryColor?: string;
      accentColor?: string;
      logoUrl?: string;
      tagline?: string;
    } = {},
  ) {
    const cid = id();
    const slug = opts.slug ? slugify(opts.slug) : uniqueSlug(name, Clubs.slugExists);
    run(
      `INSERT INTO Club (id, name, description, ownerId, inviteCode, slug, primaryColor, accentColor, logoUrl, tagline)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      cid, name, opts.description ?? null, ownerId, code(), slug,
      opts.primaryColor ?? null, opts.accentColor ?? null, opts.logoUrl ?? null, opts.tagline ?? null,
    );
    Memberships.add(cid, ownerId, "OWNER");
    return Clubs.byId(cid)!;
  },
};
```

Add the slug import at the top of `repo.ts`:

```ts
import { slugify, uniqueSlug } from "./slug";
```

Note: if `opts.slug` is user-supplied it is NOT auto-deduped — a duplicate will hit the unique index and throw. The create-group form (Task 5.1) validates availability before submit; the action (Task 4.1) also guards.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/repo-clubs.test.ts`
Expected: 4 tests passing.

- [ ] **Step 5: Fix the one existing caller and typecheck**

`src/app/dashboard/sharing/actions.ts:15` currently calls `Clubs.create(user.id, name, String(fd.get("description") || "") || undefined)`. Update it to the options form (full action rewrite happens in Task 4.1; for now make it compile):

```ts
  const club = Clubs.create(user.id, name, { description: String(fd.get("description") || "") || undefined });
```

Run: `npx tsc --noEmit`
Expected: PASS (clean).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/db.ts src/lib/repo.ts src/app/dashboard/sharing/actions.ts tests/repo-clubs.test.ts
git commit -m "feat: add slug + branding to Club model with backfill migration"
```

### Task 1.5: Mirror schema in `scripts/schema.sql` and `scripts/seed.mjs`

**Files:**
- Modify: `scripts/schema.sql` (the `CREATE TABLE Club` block)
- Modify: `scripts/seed.mjs` (club inserts)

- [ ] **Step 1: Update `scripts/schema.sql`**

Find the `CREATE TABLE ... Club (...)` statement and make it match `db.ts` exactly:

```sql
CREATE TABLE IF NOT EXISTS Club (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  ownerId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  inviteCode TEXT UNIQUE NOT NULL,
  slug TEXT,
  primaryColor TEXT,
  accentColor TEXT,
  logoUrl TEXT,
  tagline TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_slug ON Club(slug);
```

- [ ] **Step 2: Update the seed's club insert**

In `scripts/seed.mjs`, locate the Club `INSERT` (the seeded `GARAGE` club). Add `slug` (and optionally `primaryColor`) to the column list and values. Example — adapt to the file's existing variable names:

```js
db.prepare(
  `INSERT INTO Club (id, name, description, ownerId, inviteCode, slug, primaryColor)
   VALUES (?,?,?,?,?,?,?)`
).run(clubId, "The Garage", "Demo car-share group", demoUserId, "GARAGE", "the-garage", "#dc2626");
```

- [ ] **Step 3: Re-seed and verify**

Run: `npm run seed`
Then verify the slug landed:

Run: `node --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; const d=new DatabaseSync('./data/app.db'); console.log(d.prepare('SELECT name, slug FROM Club').all());"`
Expected: every club row has a non-null `slug` (e.g. `the-garage`).

- [ ] **Step 4: Commit**

```bash
git add scripts/schema.sql scripts/seed.mjs
git commit -m "chore: mirror Club slug/branding schema in seed + schema.sql"
```

---

## Phase 2 — Group context + resolver

### Task 2.1: `checkGroupAccess` (pure, TDD) + `requireGroupMember` (glue)

**Files:**
- Create: `src/lib/group.ts`
- Test: `tests/group-access.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/group-access.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGroupAccess } from "../src/lib/group";
import type { Club, ClubMembership } from "../src/lib/types";

const club = { id: "c1", ownerId: "owner" } as Club;
const ownerMembership = { id: "m1", clubId: "c1", userId: "owner", role: "OWNER" } as ClubMembership;
const memberMembership = { id: "m2", clubId: "c1", userId: "bob", role: "MEMBER" } as ClubMembership;

test("missing club -> not-found", () => {
  assert.deepEqual(checkGroupAccess(undefined, undefined, "bob"), { ok: false, reason: "not-found" });
});

test("non-member -> not-member", () => {
  assert.deepEqual(checkGroupAccess(club, undefined, "bob"), { ok: false, reason: "not-member" });
});

test("member -> ok, not owner", () => {
  assert.deepEqual(checkGroupAccess(club, memberMembership, "bob"), { ok: true, isOwner: false });
});

test("owner -> ok, isOwner true", () => {
  assert.deepEqual(checkGroupAccess(club, ownerMembership, "owner"), { ok: true, isOwner: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/group-access.test.ts`
Expected: FAIL — cannot find module `../src/lib/group`.

- [ ] **Step 3: Implement `src/lib/group.ts`**

```ts
import { notFound } from "next/navigation";
import { requireUser } from "./auth";
import { Clubs, Memberships } from "./repo";
import type { Club, ClubMembership, User } from "./types";

export type GroupAccess =
  | { ok: true; isOwner: boolean }
  | { ok: false; reason: "not-found" | "not-member" };

/** Pure authorization decision — unit tested. */
export function checkGroupAccess(
  club: Club | undefined,
  membership: ClubMembership | undefined,
  userId: string,
): GroupAccess {
  if (!club) return { ok: false, reason: "not-found" };
  if (!membership) return { ok: false, reason: "not-member" };
  return { ok: true, isOwner: club.ownerId === userId };
}

export interface GroupContext {
  user: User;
  club: Club;
  membership: ClubMembership;
  isOwner: boolean;
}

/**
 * Resolve a group by slug and authorize the current user as a member.
 * Call this at the top of every /g/[slug] server component / action.
 * Non-members get a 404 (we do not reveal that the group exists).
 */
export async function requireGroupMember(slug: string): Promise<GroupContext> {
  const user = await requireUser();
  const club = Clubs.bySlug(slug);
  const membership = club ? Memberships.of(club.id, user.id) : undefined;
  const access = checkGroupAccess(club, membership, user.id);
  if (!access.ok) notFound();
  return { user, club: club!, membership: membership!, isOwner: access.isOwner };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/group-access.test.ts`
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/group.ts tests/group-access.test.ts
git commit -m "feat: add group resolver and pure access check"
```

---

## Phase 3 — Group-scoped routing (path-based) + branding

### Task 3.1: Per-group branding via CSS variable

**Files:**
- Modify: `src/app/globals.css:36-40`

- [ ] **Step 1: Make `.btn-accent` read a CSS variable**

Replace the `.btn-accent` rule with:

```css
  /* Editorial CTA — group-themeable. Defaults to the design-system action red;
     the /g/[slug] layout overrides --group-accent / --group-accent-strong. */
  .btn-accent {
    @apply btn rounded-full text-white shadow-sm;
    background-color: var(--group-accent, #dc2626);
  }
  .btn-accent:hover {
    background-color: var(--group-accent-strong, #b91c1c);
  }
```

- [ ] **Step 2: Verify the default still builds**

Run: `npm run build` (or `npx tsc --noEmit` for a quick check; full build verifies CSS)
Expected: build succeeds; default red unchanged anywhere outside a group.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: make accent CTA color themeable via --group-accent"
```

### Task 3.2: Group route — layout (auth gate + branding + nav)

**Files:**
- Create: `src/app/g/[slug]/layout.tsx`
- Create: `src/app/g/[slug]/not-found.tsx`

- [ ] **Step 1: Create the group layout**

`src/app/g/[slug]/layout.tsx` — resolves+authorizes the group, applies branding via CSS vars, renders a group header with a link back to the global garage:

```tsx
import Link from "next/link";
import type { CSSProperties } from "react";
import { requireGroupMember } from "@/lib/group";

// Derive a darker hover shade by reusing the same hex; good enough for branding.
function brandStyle(primary: string | null, accent: string | null): CSSProperties {
  const main = primary ?? "#dc2626";
  return {
    ["--group-accent" as string]: main,
    ["--group-accent-strong" as string]: accent ?? main,
  };
}

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const { club } = await requireGroupMember(params.slug);

  return (
    <div className="min-h-screen bg-white" style={brandStyle(club.primaryColor, club.accentColor)}>
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            {club.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={club.logoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
                style={{ backgroundColor: "var(--group-accent)" }}
              >
                {club.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink-900">{club.name}</p>
              {club.tagline && <p className="text-xs text-ink-500">{club.tagline}</p>}
            </div>
          </div>
          <Link href="/dashboard/collection" className="text-sm text-ink-500 hover:text-ink-900">
            ← My garage
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6 md:pb-12">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create the not-found page**

`src/app/g/[slug]/not-found.tsx`:

```tsx
import Link from "next/link";

export default function GroupNotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink-900">Group not found</h1>
      <p className="mt-2 text-sm text-ink-500">
        This group doesn&apos;t exist, or you&apos;re not a member. Ask an owner for an invite code.
      </p>
      <Link href="/dashboard/sharing" className="btn-primary mt-6">Back to your groups</Link>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/g/[slug]/layout.tsx src/app/g/[slug]/not-found.tsx
git commit -m "feat: add /g/[slug] layout with branding + member auth gate"
```

### Task 3.3: Group home page (migrate club page to slug route)

**Files:**
- Create: `src/app/g/[slug]/page.tsx`

- [ ] **Step 1: Create the group home page**

Port the legacy `dashboard/sharing/[clubId]/page.tsx` to resolve by slug via `requireGroupMember`. Note: the layout already authorized membership, but the page re-resolves to get `club`/`isOwner` (cheap, and keeps the page self-contained). The "Manage" link for owners now points to the global collection share tab (unchanged), and "Invite/Leave" controls keep working via club id.

```tsx
import Link from "next/link";
import { requireGroupMember } from "@/lib/group";
import { Memberships, Shares } from "@/lib/repo";
import { VehicleImage } from "@/components/VehicleImage";
import { InviteCode, LeaveClubButton } from "@/app/dashboard/sharing/[clubId]/ClubControls";
import { BookForm } from "@/app/dashboard/sharing/BookingButtons";

export default async function GroupHome({ params }: { params: { slug: string } }) {
  const { user, club, isOwner } = await requireGroupMember(params.slug);

  const members = Memberships.forClub(club.id);
  const shared = Shares.forClub(club.id);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{club.name}</h1>
          {club.description && <p className="text-sm text-ink-500">{club.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <InviteCode code={club.inviteCode} />
          {!isOwner && <LeaveClubButton clubId={club.id} />}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Members ({members.length})</h2>
        <div className="card divide-y divide-ink-50">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
                  {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <div className="text-sm">
                  <p className="font-medium text-ink-900">{m.name}{m.userId === user.id ? " (you)" : ""}</p>
                  <p className="text-ink-400">{m.email}</p>
                </div>
              </div>
              <span className="pill bg-ink-50 text-ink-500">{m.role[0] + m.role.slice(1).toLowerCase()}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Cars in this group ({shared.length})</h2>
        {shared.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-400">
            No cars shared here yet. Open a car in your garage → <span className="font-medium">Share</span> tab to add one.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shared.map((v: any) => {
              const mine = v.ownerId === user.id;
              return (
                <div key={v.id} className="card overflow-hidden">
                  <VehicleImage src={v.imageUrl} alt={`${v.make} ${v.model}`} className="h-40 w-full" />
                  <div className="p-4">
                    <p className="text-xs text-ink-400">{v.year} · Owner: {v.ownerName}{mine ? " (you)" : ""}</p>
                    <p className="font-medium text-ink-900">{v.make} {v.model}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="pill bg-ink-50 text-ink-500">{v.requireApproval ? "Approval needed" : "Instant book"}</span>
                      {mine ? (
                        <Link href={`/dashboard/collection/${v.id}/share`} className="btn-ghost text-xs">Manage</Link>
                      ) : (
                        <BookForm vehicleId={v.id} requireApproval={!!v.requireApproval} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (`ClubControls` and `BookingButtons` are reused in place; do not move them yet.)

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, sign in as `demo@mycollection.world` / `password`, visit `/g/the-garage`.
Expected: group home renders with members + cars, branded accent on any `.btn-accent`. Visit `/g/does-not-exist` → group-not-found page. Sign in as a user who is NOT in the garage and visit `/g/the-garage` → not-found (no data leak).

- [ ] **Step 4: Commit**

```bash
git add src/app/g/[slug]/page.tsx
git commit -m "feat: group home at /g/[slug] resolved by slug"
```

### Task 3.4: Point the groups hub at slug URLs + redirect legacy club URL

**Files:**
- Modify: `src/app/dashboard/sharing/page.tsx:57` (the group card `href`)
- Modify: `src/app/dashboard/sharing/[clubId]/page.tsx` (replace body with redirect)

- [ ] **Step 1: Update the group card link**

In `src/app/dashboard/sharing/page.tsx`, change the clubs map link target from the club id to the slug. The `Clubs.forUser` row now includes `slug`:

```tsx
              <Link key={c.id} href={`/g/${c.slug}`} className="card group p-5 transition hover:shadow-lg">
```

- [ ] **Step 2: Replace the legacy `[clubId]` page with a redirect**

Overwrite `src/app/dashboard/sharing/[clubId]/page.tsx` so old bookmarks/links still work:

```tsx
import { redirect, notFound } from "next/navigation";
import { Clubs } from "@/lib/repo";

export default function LegacyClubRedirect({ params }: { params: { clubId: string } }) {
  const club = Clubs.byId(params.clubId);
  if (!club) notFound();
  redirect(`/g/${club.slug}`);
}
```

Note: `ClubControls.tsx` stays in the `[clubId]/` folder and is imported by the new group page — that's fine; only `page.tsx` changes.

- [ ] **Step 3: Typecheck + manual check**

Run: `npx tsc --noEmit` → PASS.
Run dev, click a group card on `/dashboard/sharing` → lands on `/g/<slug>`. Visit an old `/dashboard/sharing/<clubId>` URL → redirects to `/g/<slug>`.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/sharing/page.tsx src/app/dashboard/sharing/[clubId]/page.tsx
git commit -m "feat: link groups hub to /g/[slug] and redirect legacy club URLs"
```

### Task 3.5: Group switcher in the global nav

**Files:**
- Create: `src/components/GroupSwitcher.tsx`
- Modify: `src/app/dashboard/layout.tsx` (pass groups, render switcher)
- Modify: `src/components/AppNav.tsx` (accept + render switcher slot)

- [ ] **Step 1: Create the switcher (client component)**

`src/components/GroupSwitcher.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

interface GroupLink { slug: string; name: string }

export function GroupSwitcher({ groups }: { groups: GroupLink[] }) {
  const [open, setOpen] = useState(false);
  if (groups.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost text-xs"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Groups ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-lift"
          onMouseLeave={() => setOpen(false)}
        >
          {groups.map((g) => (
            <Link
              key={g.slug}
              role="menuitem"
              href={`/g/${g.slug}`}
              className="block px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"
              onClick={() => setOpen(false)}
            >
              {g.name}
            </Link>
          ))}
          <Link
            href="/dashboard/sharing"
            className="block border-t border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-900 hover:bg-ink-50"
            onClick={() => setOpen(false)}
          >
            Manage groups →
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Pass groups from the dashboard layout**

Update `src/app/dashboard/layout.tsx`:

```tsx
import { requireUser } from "@/lib/auth";
import { Clubs } from "@/lib/repo";
import { TopNav, BottomNav } from "@/components/AppNav";

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const groups = Clubs.forUser(user.id).map((c) => ({ slug: c.slug, name: c.name }));
  return (
    <div className="min-h-screen bg-white">
      <TopNav initials={initialsOf(user.name)} groups={groups} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6 md:pb-12">{children}</main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Render the switcher in `TopNav`**

In `src/components/AppNav.tsx`, import the switcher and add a `groups` prop to `TopNav`. Change the `TopNav` signature and insert the switcher before the avatar link:

```tsx
import { GroupSwitcher } from "./GroupSwitcher";

export function TopNav({ initials, groups }: { initials: string; groups: { slug: string; name: string }[] }) {
```

Then, inside the `<nav>` of `TopNav`, immediately before the avatar `<Link href="/dashboard/profile" ...>`, add:

```tsx
          <GroupSwitcher groups={groups} />
```

- [ ] **Step 4: Typecheck + manual check**

Run: `npx tsc --noEmit` → PASS.
Run dev: the desktop top nav shows a "Groups ▾" menu listing your groups; selecting one navigates to `/g/<slug>`.

- [ ] **Step 5: Commit**

```bash
git add src/components/GroupSwitcher.tsx src/app/dashboard/layout.tsx src/components/AppNav.tsx
git commit -m "feat: group switcher in dashboard nav"
```

---

## Phase 4 — Isolation audit + tests (the security gate)

### Task 4.1: Harden `createClub` / `joinClub` / `leaveClub` and redirect to slug

**Files:**
- Modify: `src/app/dashboard/sharing/actions.ts:11-37`

- [ ] **Step 1: Rewrite the three club actions**

`createClub` accepts branding and a desired slug (validated/deduped), redirects to `/g/<slug>`. `joinClub` redirects to the slug. `leaveClub` redirects to the hub.

```ts
export async function createClub(fd: FormData) {
  const user = await requireUser();
  const name = String(fd.get("name") || "").trim();
  if (!name) return { error: "Name is required." };

  const desiredSlug = String(fd.get("slug") || "").trim();
  // Normalize + ensure uniqueness server-side regardless of client preview.
  const slug = desiredSlug
    ? uniqueSlug(desiredSlug, Clubs.slugExists)
    : uniqueSlug(name, Clubs.slugExists);

  const club = Clubs.create(user.id, name, {
    description: String(fd.get("description") || "") || undefined,
    slug,
    primaryColor: String(fd.get("primaryColor") || "") || undefined,
    logoUrl: String(fd.get("logoUrl") || "") || undefined,
    tagline: String(fd.get("tagline") || "") || undefined,
  });
  revalidatePath("/dashboard/sharing");
  redirect(`/g/${club.slug}`);
}

export async function joinClub(fd: FormData) {
  const user = await requireUser();
  const code = String(fd.get("code") || "").trim().toUpperCase();
  const club = Clubs.byInvite(code);
  if (!club) return { error: "No group found for that invite code." };
  Memberships.add(club.id, user.id, "MEMBER");
  revalidatePath("/dashboard/sharing");
  redirect(`/g/${club.slug}`);
}

export async function leaveClub(clubId: string) {
  const user = await requireUser();
  const club = Clubs.byId(clubId);
  if (!club || club.ownerId === user.id) return; // owner can't leave
  Memberships.remove(clubId, user.id);
  revalidatePath("/dashboard/sharing");
  redirect("/dashboard/sharing");
}
```

Add `uniqueSlug` to the imports from `@/lib/slug`:

```ts
import { uniqueSlug } from "@/lib/slug";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/sharing/actions.ts
git commit -m "feat: group actions accept branding/slug and redirect to /g/[slug]"
```

### Task 4.2: Cross-group isolation tests (repo + action authorization)

**Files:**
- Test: `tests/isolation.test.ts`

These tests lock in the guarantee that a member of group A cannot read or book into group B. They exercise the repo functions the routes/actions rely on (`Shares.forClub`, `Shares.isBookableBy`, `Memberships.of`, `Shares.bookableFor`).

- [ ] **Step 1: Write the tests**

Create `tests/isolation.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/testdb";
import { Users, Clubs, Memberships, Vehicles, Shares } from "../src/lib/repo";

function user(email: string) {
  return Users.create({ name: email.split("@")[0], email, passwordHash: "x" });
}

test("a car shared into group A is not bookable by a member of only group B", () => {
  const alice = user("alice@ex.com"); // owns car, in group A
  const bob = user("bob@ex.com");     // in group B only

  const groupA = Clubs.create(alice.id, "Group A");
  const groupB = Clubs.create(bob.id, "Group B");
  Memberships.add(groupB.id, bob.id, "MEMBER"); // already owner, no-op safety

  const car = Vehicles.create({ ownerId: alice.id, make: "Mazda", model: "MX-5", year: 1995 });
  Shares.add(car.id, groupA.id, true); // shared into A only

  // Bob is not in group A -> car not bookable by Bob
  assert.equal(Shares.isBookableBy(car.id, bob.id), undefined);

  // Bob's bookable list does not include the car
  const bobBookable = Shares.bookableFor(bob.id);
  assert.equal(bobBookable.some((v) => v.id === car.id), false);
});

test("Shares.forClub returns only that group's cars", () => {
  const alice = user("alice2@ex.com");
  const a = Clubs.create(alice.id, "Alpha");
  const b = Clubs.create(alice.id, "Bravo");
  const carA = Vehicles.create({ ownerId: alice.id, make: "Honda", model: "S2000", year: 2003 });
  const carB = Vehicles.create({ ownerId: alice.id, make: "Toyota", model: "AE86", year: 1986 });
  Shares.add(carA.id, a.id, true);
  Shares.add(carB.id, b.id, true);

  const inA = Shares.forClub(a.id) as any[];
  assert.equal(inA.length, 1);
  assert.equal(inA[0].id, carA.id);
});

test("Memberships.of returns undefined for a non-member (gate for requireGroupMember)", () => {
  const owner = user("owner3@ex.com");
  const stranger = user("stranger3@ex.com");
  const club = Clubs.create(owner.id, "Closed Club");
  assert.equal(Memberships.of(club.id, stranger.id), undefined);
  assert.ok(Memberships.of(club.id, owner.id)); // owner is a member
});

test("once Bob joins group A, the car becomes bookable", () => {
  const alice = user("alice4@ex.com");
  const bob = user("bob4@ex.com");
  const a = Clubs.create(alice.id, "Joinable");
  const car = Vehicles.create({ ownerId: alice.id, make: "BMW", model: "M3", year: 2008 });
  Shares.add(car.id, a.id, false);

  assert.equal(Shares.isBookableBy(car.id, bob.id), undefined);
  Memberships.add(a.id, bob.id, "MEMBER");
  assert.ok(Shares.isBookableBy(car.id, bob.id)); // now bookable
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- tests/isolation.test.ts`
Expected: 4 tests passing. If any fail, the isolation guarantee is broken — fix the repo query, not the test.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: all phases' tests green (harness, slug, repo-clubs, group-access, isolation).

- [ ] **Step 4: Manual penetration check**

Run dev. Create two accounts in two separate groups. Confirm:
- Account B visiting account A's `/g/<slugA>` → group-not-found (404), no member or car data rendered.
- Account B's `/dashboard/sharing` "Available to borrow" never lists cars shared only into group A.

- [ ] **Step 5: Commit**

```bash
git add tests/isolation.test.ts
git commit -m "test: cross-group data isolation guarantees"
```

### Task 4.3: Audit checklist (no code unless a gap is found)

- [ ] Read each function in `src/lib/repo.ts` that takes a `clubId` (`Memberships.forClub`, `Shares.forClub`) and confirm its only callers first pass through `requireGroupMember` (group pages) — they do after Phase 3. Pages that read club-scoped data MUST call `requireGroupMember(params.slug)` and use the returned `club.id`, never a raw id from the URL/form.
- [ ] Confirm `src/app/dashboard/sharing/booking/[bookingId]/page.tsx` and `saveHandover`/`decideBooking`/`cancelBooking`/`completeBooking` in `actions.ts` authorize by **owner or borrower of the booking** (they already do via `Vehicles.forOwner` / `booking.borrowerId === user.id`). These are user-scoped, not group-scoped, and remain correct — no change. Note this explicitly in the commit message if reviewed.
- [ ] Confirm `shareVehicle` still checks `Memberships.of(clubId, user.id)` before sharing (it does, `actions.ts:47`) — a user cannot share a car into a group they don't belong to.
- [ ] If any gap is found, add a failing test to `tests/isolation.test.ts` first, then fix.

---

## Phase 5 — Provisioning polish (create-group form)

### Task 5.1: Create-group form with slug preview + branding inputs

**Files:**
- Modify: `src/app/dashboard/sharing/ClubButtons.tsx`

Read the current `ClubButtons.tsx` first to match its existing modal/form pattern (it renders `CreateClubButton`/`JoinClubButton` using `@/components/Modal` and the `createClub`/`joinClub` actions). Extend ONLY the create form.

- [ ] **Step 1: Add fields to the create-group form**

Inside the create form (the one that calls `createClub`), add inputs below the existing name/description fields. The action already reads `slug`, `primaryColor`, `logoUrl`, `tagline` (Task 4.1):

```tsx
        <div>
          <label className="label" htmlFor="cg-slug">Group URL</label>
          <div className="flex items-center gap-1 text-sm text-ink-500">
            <span>/g/</span>
            <input
              id="cg-slug"
              name="slug"
              className="input"
              placeholder="mountain-drivers"
              pattern="[a-z0-9-]*"
              title="lowercase letters, numbers, and dashes only"
            />
          </div>
          <p className="mt-1 text-xs text-ink-400">Leave blank to auto-generate from the name. Must be unique.</p>
        </div>
        <div>
          <label className="label" htmlFor="cg-tagline">Tagline (optional)</label>
          <input id="cg-tagline" name="tagline" className="input" placeholder="Weekend canyon runs" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label" htmlFor="cg-color">Accent color</label>
            <input id="cg-color" name="primaryColor" type="color" defaultValue="#dc2626" className="h-10 w-full rounded-xl border border-ink-200" />
          </div>
          <div className="flex-[2]">
            <label className="label" htmlFor="cg-logo">Logo URL (optional)</label>
            <input id="cg-logo" name="logoUrl" className="input" placeholder="https://…/logo.png" />
          </div>
        </div>
```

- [ ] **Step 2: Surface the action's error (if the form doesn't already)**

If `createClub` returns `{ error }` and the form currently ignores it, ensure the form is a client component that renders the returned error (mirror the existing `joinClub` error handling already used for the invite-code form). Keep the existing pattern — do not invent a new one.

- [ ] **Step 3: Typecheck + manual check**

Run: `npx tsc --noEmit` → PASS.
Run dev → "Create group": set name + a custom URL slug + an accent color, submit → redirected to `/g/<slug>`; the group header shows the chosen accent and any logo; `.btn-accent` uses the new color.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/sharing/ClubButtons.tsx
git commit -m "feat: create-group form with slug + branding inputs"
```

---

## Phase 6 — Production deploy (single container, persistent volume)

### Task 6.1: Standalone output + Dockerfile + .dockerignore

**Files:**
- Modify: `next.config.js`
- Create: `Dockerfile`, `.dockerignore`

- [ ] **Step 1: Enable standalone output**

In `next.config.js`, add `output: "standalone"` to the config object (keep existing `images`):

```js
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};
```

- [ ] **Step 2: Create `.dockerignore`**

```
node_modules
.next
.git
data
*.db
*.db-journal
.env
.env.*
npm-debug.log
Dockerfile
.dockerignore
docs
design-system
```

- [ ] **Step 3: Create the `Dockerfile`**

Node 22.5+ required for `node:sqlite`; use Node 22 to match `engines`. (Do NOT use Alpine for the `node:sqlite` build — use the Debian-slim image to avoid native quirks.)

```dockerfile
# --- deps ---
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build ---
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- run ---
FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Standalone server + static assets
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/scripts ./scripts
# Persistent SQLite lives on a mounted volume at /data
ENV DATA_DIR=/data
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4: Build the image locally**

Run: `docker build -t mycollection .`
Expected: build completes; final image present.

- [ ] **Step 5: Run the container with a volume + secret**

```bash
docker run --rm -p 3000:3000 \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -v mycollection-data:/data \
  mycollection
```

Then check health:

Run: `curl -s localhost:3000/healthz`
Expected: `{"ok":true}`

(First run starts with an empty DB; the schema auto-migrates on first query. To seed demo data into the volume, exec `node scripts/seed.mjs` inside the container — but NEVER against real data; seed wipes.)

- [ ] **Step 6: Commit**

```bash
git add next.config.js Dockerfile .dockerignore
git commit -m "build: containerize with standalone output and /data volume"
```

### Task 6.2: Production runbook

**Files:**
- Create: `docs/PRODUCTION.md`

- [ ] **Step 1: Write the runbook**

```markdown
# Production Deploy & Operations

## Target
One container, one SQLite database on a persistent volume. Serves all groups
(≤20 groups × ≤20 users). Path-based group URLs (`/g/<slug>`) — no wildcard DNS needed.

## Hosts (pick one)
- **Fly.io** — `fly launch`, attach a volume (`fly volumes create data -s 1`), mount at `/data`, set `DATA_DIR=/data`.
- **Railway** — add a Volume mounted at `/data`, set `DATA_DIR=/data`.
- **Render** — Web Service from Dockerfile + a Disk mounted at `/data`, set `DATA_DIR=/data`.

## Required environment
- `SESSION_SECRET` — `openssl rand -hex 32`. App refuses to boot in prod without a real one.
- `DATA_DIR=/data` — the mounted volume path.
- `NODE_ENV=production` (set by the image).

## Scaling constraint
Run **exactly one instance**. The SQLite connection and the auth rate limiter are
in-process; a second instance would get a separate DB and split rate-limit state.
This is fine for the target scale.

## Backups (do not skip)
The whole app is one file: `/data/app.db`. Options:
- Volume snapshots on the host (simplest).
- Cron `sqlite3 /data/app.db ".backup '/data/backup-$(date +%F).db'"` then copy off-box.
- Or add Litestream later to stream WAL to S3/R2.
Test a restore at least once.

## Health
`GET /healthz` → `{"ok":true}`. Point the platform's health check here.

## Seeding
`npm run seed` / `node scripts/seed.mjs` **wipes** the DB. Never run against live data.
```

- [ ] **Step 2: Commit**

```bash
git add docs/PRODUCTION.md
git commit -m "docs: production deploy and backup runbook"
```

### Task 6.3: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds, no type errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors (warnings acceptable).

- [ ] **Step 4: Final commit (if anything changed)**

```bash
git add -A
git commit -m "chore: verify multi-group build, tests, lint green"
```

---

## Self-Review (completed during planning)

**Spec coverage:**
- "≤20 groups, ≤20 users each, one deployment" → Phases 1–6 keep one DB/one container; Phase 6 runbook fixes single-instance. ✓
- "One account, many groups" → garage stays global (`/dashboard/collection`); `Clubs.forUser` + group switcher (Task 3.5); membership model unchanged. ✓
- "Per-group URL + branding" → slug (Phase 1), `/g/[slug]` routing (Phase 3), CSS-var accent + logo/tagline (Tasks 3.1–3.3, 5.1). ✓
- "Shared DB, code-enforced isolation" → `requireGroupMember` gate (Phase 2), isolation tests + audit (Phase 4). ✓
- Path-based (not subdomain) per the user's decision → `/g/[slug]`, no DNS work; resolver reads slug from path. ✓

**Placeholder scan:** No "TBD"/"add validation"/"similar to" — every code step has full code. The two steps that say "read the existing file first" (Task 5.1, Task 4.3) are audits of un-read files (`ClubButtons.tsx`, booking page) and give concrete additions/checks, not deferrals.

**Type consistency:** `Club` gains `slug/primaryColor/accentColor/logoUrl/tagline` (Task 1.2) and every later use matches. `Clubs.create(ownerId, name, opts)` options object is consistent across repo (1.4), the smoke fix (1.4 step 5), and `createClub` (4.1). `requireGroupMember` returns `{ user, club, membership, isOwner }` and is destructured consistently in layout (3.2) and page (3.3). `GroupSwitcher` takes `{ slug, name }[]` consistently in layout (3.5) and AppNav (3.5).

**Open risk to watch during execution:** `ClubControls.tsx` and `BookingButtons.tsx` are imported from the legacy `dashboard/sharing/...` folders by the new group page (3.3). They are intentionally NOT moved to keep the diff small; if a later cleanup moves them, update both import paths.
