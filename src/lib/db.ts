import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Singleton across hot reloads in dev.
const g = globalThis as unknown as { __mcDb?: DatabaseSync };

function open(): DatabaseSync {
  const dir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "app.db"));
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

// Lazy singleton — the connection is only opened on first query, not at import.
// This keeps Next.js build workers from opening the file during static analysis.
function conn(): DatabaseSync {
  return g.__mcDb ?? (g.__mcDb = open());
}

function migrate(db: DatabaseSync) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS User (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS Vehicle (
    id TEXT PRIMARY KEY,
    ownerId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    imageUrl TEXT,
    cylinders INTEGER,
    performanceKw INTEGER,
    mileageKm INTEGER NOT NULL DEFAULT 0,
    vin TEXT,
    color TEXT,
    description TEXT,
    visibility TEXT NOT NULL DEFAULT 'PRIVATE',
    currency TEXT NOT NULL DEFAULT 'EUR',
    vehicleType TEXT,
    bodyStyle TEXT,
    previousOwners INTEGER,
    unitsProduced INTEGER,
    transmissionNumber TEXT,
    location TEXT,
    gearbox TEXT,
    driveType TEXT,
    driversSide TEXT,
    matchingNumbers INTEGER NOT NULL DEFAULT 0,
    keyFacts TEXT,
    overview TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS Expense (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES Vehicle(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'QUICK COST',
    amount REAL NOT NULL,
    date TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS Document (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES Vehicle(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'PDF',
    fileUrl TEXT,
    uploadedById TEXT REFERENCES User(id),
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS TimelineEvent (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES Vehicle(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    imageUrl TEXT,
    category TEXT NOT NULL DEFAULT 'HISTORY',
    eventDate TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS GalleryImage (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES Vehicle(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    caption TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS Club (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    ownerId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
    inviteCode TEXT UNIQUE NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ClubMembership (
    id TEXT PRIMARY KEY,
    clubId TEXT NOT NULL REFERENCES Club(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER',
    joinedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(clubId, userId)
  );

  CREATE TABLE IF NOT EXISTS VehicleShare (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES Vehicle(id) ON DELETE CASCADE,
    clubId TEXT NOT NULL REFERENCES Club(id) ON DELETE CASCADE,
    requireApproval INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(vehicleId, clubId)
  );

  CREATE TABLE IF NOT EXISTS Booking (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL REFERENCES Vehicle(id) ON DELETE CASCADE,
    borrowerId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    purpose TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS HandoverLog (
    id TEXT PRIMARY KEY,
    bookingId TEXT UNIQUE NOT NULL REFERENCES Booking(id) ON DELETE CASCADE,
    pickupMileageKm INTEGER,
    returnMileageKm INTEGER,
    pickupFuelPct INTEGER,
    returnFuelPct INTEGER,
    conditionNotes TEXT,
    damageReported INTEGER NOT NULL DEFAULT 0,
    checklistJson TEXT,
    pickedUpAt TEXT,
    returnedAt TEXT,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `);

  // Upgrade existing databases that pre-date newer columns.
  ensureColumns(db, "Vehicle", {
    vehicleType: "TEXT",
    bodyStyle: "TEXT",
    previousOwners: "INTEGER",
    unitsProduced: "INTEGER",
    transmissionNumber: "TEXT",
    location: "TEXT",
    gearbox: "TEXT",
    driveType: "TEXT",
    driversSide: "TEXT",
    matchingNumbers: "INTEGER NOT NULL DEFAULT 0",
    keyFacts: "TEXT",
    overview: "TEXT",
  });
  ensureColumns(db, "TimelineEvent", {
    category: "TEXT NOT NULL DEFAULT 'HISTORY'",
    eventDate: "TEXT",
  });
}

function ensureColumns(db: DatabaseSync, table: string, columns: Record<string, string>) {
  const existing = new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
  );
  for (const [name, def] of Object.entries(columns)) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def};`);
    }
  }
}

export function id(): string {
  return crypto.randomUUID();
}

// node:sqlite returns rows with a null prototype, which Next.js refuses to
// serialize across the Server → Client Component boundary. Re-wrap into a
// plain object so every consumer is safe by default.
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

// Small helpers for ergonomic typed queries. The connection opens lazily here.
export function get<T = unknown>(sql: string, ...params: unknown[]): T | undefined {
  const row = conn().prepare(sql).get(...params);
  return row == null ? undefined : plain<T>(row);
}
export function all<T = unknown>(sql: string, ...params: unknown[]): T[] {
  return (conn().prepare(sql).all(...params) as unknown[]).map((r) => plain<T>(r));
}
export function run(sql: string, ...params: unknown[]) {
  return conn().prepare(sql).run(...params);
}
