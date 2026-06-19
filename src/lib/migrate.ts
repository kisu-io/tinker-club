import type postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { slugify } from "./slug";

type Sql = ReturnType<typeof postgres>;

/**
 * Run schema.sql as a single multi-statement query (postgres.js supports this
 * when prepared statements are disabled). This avoids the fragile `;`-splitter
 * that breaks on semicolons inside string literals, function bodies, or DO blocks.
 */
export async function runSchema(sql: Sql, schemaPath?: string): Promise<void> {
  const p = schemaPath ?? path.join(process.cwd(), "scripts", "schema.sql");
  const ddl = fs.readFileSync(p, "utf8");
  // Send the entire DDL as one multi-statement query. postgres.js executes it
  // as a simple query (no prepared statement), which Postgres parses fine.
  await sql.unsafe(ddl);
}

/** Backfill NULL/empty Club slugs from the club name. */
export async function backfillClubSlugs(sql: Sql): Promise<void> {
  const rows = (await sql`SELECT id, name FROM "Club" WHERE slug IS NULL OR slug = ''`) as unknown as { id: string; name: string }[];
  if (!rows.length) return;

  const taken = new Set(
    ((await sql`SELECT slug FROM "Club" WHERE slug IS NOT NULL AND slug <> ''`) as unknown as { slug: string }[]).map((r) => r.slug),
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

/** Full migration: schema + backfill. Shared by db.ts and seed.mjs. */
export async function migrate(sql: Sql, schemaPath?: string): Promise<void> {
  await runSchema(sql, schemaPath);
  await backfillClubSlugs(sql);
}