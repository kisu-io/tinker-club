import postgres from "postgres";
import crypto from "node:crypto";
import { migrate } from "./migrate";

// ---------------------------------------------------------------------------
// Postgres connection (Supabase or any standard Postgres).
//
// DATABASE_URL must be set at runtime (e.g.
//   postgresql://postgres.xxxx:pass@aws-0-region.pooler.supabase.com:6543/postgres
// ). Lazy singleton so Next build workers don't open a connection during
// static analysis. Migration runs once and is awaited before the handle is
// returned, so the first query never hits a partially-migrated schema.
// ---------------------------------------------------------------------------

type Sql = ReturnType<typeof postgres>;

const g = globalThis as unknown as { __mcDb?: Sql; __mcDbReady?: Promise<Sql> };

function connect(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it to your Postgres/Supabase connection string.",
    );
  }

  // Supabase pooler (transaction mode, port 6543) doesn't support prepared
  // statements reliably; disable them for pooler-style URLs.
  const isSupabasePooler = /supabase\.com/.test(url) || /:6543/.test(url);
  return postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 30,
    prepare: !isSupabasePooler,
  });
}

/**
 * Returns the singleton sql handle, awaiting the first-run migration before
 * resolving. Subsequent calls reuse the same handle (migration only runs once).
 */
export function conn(): Promise<Sql> {
  if (g.__mcDb) return Promise.resolve(g.__mcDb);
  if (!g.__mcDbReady) {
    g.__mcDbReady = (async () => {
      const sql = connect();
      await migrate(sql);
      g.__mcDb = sql;
      return sql;
    })();
  }
  return g.__mcDbReady;
}

/** Run a callback inside a transaction. Rolls back on error. */
export async function tx<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const sql = await conn();
  return await sql.begin(async (tnx) => fn(tnx as unknown as Sql)) as T;
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

type UnsafeFn = (text: string, params: unknown[]) => Promise<unknown[]>;

function unsafe(sql: Sql): UnsafeFn {
  return (sql.unsafe as unknown as UnsafeFn);
}

export async function get<T = unknown>(sqlText: string, ...params: unknown[]): Promise<T | undefined> {
  const sql = await conn();
  const rows = await unsafe(sql)(convertPlaceholders(sqlText), params);
  if (!Array.isArray(rows) || !rows.length) return undefined;
  return rows[0] as T;
}

export async function all<T = unknown>(sqlText: string, ...params: unknown[]): Promise<T[]> {
  const sql = await conn();
  const rows = await unsafe(sql)(convertPlaceholders(sqlText), params);
  return rows as T[];
}

export async function run(sqlText: string, ...params: unknown[]): Promise<void> {
  const sql = await conn();
  await unsafe(sql)(convertPlaceholders(sqlText), params);
}

export function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}