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
  slug TEXT,
  primaryColor TEXT,
  accentColor TEXT,
  logoUrl TEXT,
  tagline TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_slug ON Club(slug);
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
