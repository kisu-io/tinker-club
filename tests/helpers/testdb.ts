// Postgres test harness. Must be imported before any repo import.
//
// Strategy: use a dedicated test database (DATABASE_URL_TEST env var, or
// fall back to the same DATABASE_URL). Truncate all tables before each test
// run so tests start from a clean state. The schema is auto-migrated by
// db.ts on first connect.
//
// Set DATABASE_URL_TEST to a scratch Postgres/Supabase database, e.g.
//   postgresql://postgres.xxxx:pass@aws-0-region.pooler.supabase.com:6543/test
// If unset, falls back to DATABASE_URL (same DB as dev — will wipe data!).

const testUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!testUrl) {
  console.error(
    "DATABASE_URL_TEST (or DATABASE_URL) must be set for tests. Point it at a scratch Postgres DB — tests truncate all tables.",
  );
  process.exit(1);
}

// Force the app to use the test URL.
process.env.DATABASE_URL = testUrl;
(process.env as { NODE_ENV?: string }).NODE_ENV = "test";

// The order matters: child tables first, then parents.
const TABLES = [
  '"HandoverLog"',
  '"Booking"',
  '"VehicleShare"',
  '"ClubMembership"',
  '"Club"',
  '"GalleryImage"',
  '"TimelineEvent"',
  '"Document"',
  '"Expense"',
  '"Vehicle"',
  '"User"',
] as const;

let cleaned = false;

/** Truncate every table. Call this in a beforeEach or at the top of each test. */
export async function resetDb(): Promise<void> {
  const { conn } = await import("../../src/lib/db");
  const sql = await conn();
  if (!cleaned) {
    // First call: ensure schema exists (db.ts auto-migrates on first conn).
    cleaned = true;
  }
  // TRUNCATE with CASCADE resets identity sequences and drops all rows.
  await sql.unsafe(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}

/** Drop the connection pool (call in a global teardown). */
export async function closeDb(): Promise<void> {
  const g = globalThis as unknown as { __mcDb?: { end: () => Promise<unknown> } };
  if (g.__mcDb) {
    await g.__mcDb.end();
    delete (g as Record<string, unknown>).__mcDb;
    delete (g as Record<string, unknown>).__mcDbReady;
  }
}