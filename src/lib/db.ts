import postgres from "postgres";
import crypto from "node:crypto";
import { slugify } from "./slug";

// ---------------------------------------------------------------------------
// Postgres connection (Supabase or any standard Postgres).
//
// DATABASE_URL must be set at runtime (e.g.
//   postgresql://postgres.xxxx:pass@aws-0-region.pooler.supabase.com:6543/postgres
// ). Lazy singleton so Next build workers don't open a connection during
// static analysis.
// ---------------------------------------------------------------------------

type Sql = ReturnType<typeof postgres>;

const g = globalThis as unknown as { __mcDb?: Sql };

function conn(): Sql {
  if (g.__mcDb) return g.__mcDb;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it to your Postgres/Supabase connection string.",
    );
  }

  // Supabase pooler (transaction mode, port 6543) doesn't support prepared
  // statements reliably; disable them for pooler-style URLs.
  const isSupabasePooler = /supabase\.com/.test(url) || /:6543/.test(url);
  const sql = postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 30,
    prepare: !isSupabasePooler,
  });

  // Auto-migrate on first connect (idempotent).
  void migrate(sql);

  g.__mcDb = sql;
  return sql;
}

async function migrate(sql: Sql) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const schemaPath = path.join(process.cwd(), "scripts", "schema.sql");
  const ddl = fs.readFileSync(schemaPath, "utf8");

  const statements = ddl
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    await sql.unsafe(stmt);
  }

  await backfillClubSlugs(sql);
}

async function backfillClubSlugs(sql: Sql) {
  const rows = (await sql`SELECT id, name FROM "Club" WHERE slug IS NULL OR slug = ''`) as unknown as { id: string; name: string }[];
  if (!rows.length) return;

  const taken = new Set(
    (
      (await sql`SELECT slug FROM "Club" WHERE slug IS NOT NULL AND slug <> ''`) as unknown as { slug: string }[]
    ).map((r) => r.slug),
  );

  for (const r of rows) {
    const base = slugify(r.name);
    let candidate = base;
    let i = 2;
    while (taken.has(candidate)) candidate = `${base}-${i++}`;
    taken.add(candidate);
    await sql`UPDATE "Club" SET slug = ${candidate} WHERE id = ${r.id}`;
  }
}

export function id(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Helpers — ergonomic typed queries. We translate SQLite-style `?`
// placeholders into Postgres `$1, $2, ...` and use sql.unsafe() so repo.ts
// doesn't need to change its SQL strings.
//
// Usage:
//   get<User>('SELECT * FROM "User" WHERE id = ?', uid)
//   all<Vehicle>('SELECT * FROM "Vehicle" WHERE "ownerId" = ?', uid)
//   run('INSERT INTO "User" (id, name) VALUES (?,?)', uid, name)
// ---------------------------------------------------------------------------

function convertPlaceholders(sqlText: string): string {
  let i = 0;
  return sqlText.replace(/\?/g, () => `$${++i}`);
}

export async function get<T = unknown>(sqlText: string, ...params: unknown[]): Promise<T | undefined> {
  const sql = conn();
  const rows = await (sql.unsafe as any)(convertPlaceholders(sqlText), params);
  if (!Array.isArray(rows) || !rows.length) return undefined;
  return rows[0] as T;
}

export async function all<T = unknown>(sqlText: string, ...params: unknown[]): Promise<T[]> {
  const sql = conn();
  const rows = await (sql.unsafe as any)(convertPlaceholders(sqlText), params);
  return rows as T[];
}

export async function run(sqlText: string, ...params: unknown[]): Promise<void> {
  const sql = conn();
  await (sql.unsafe as any)(convertPlaceholders(sqlText), params);
}

export function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}