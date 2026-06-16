// Seeds a rich demo dataset. Idempotent: wipes and re-inserts demo data.
// Run with: npm run seed   (Node 22+ for node:sqlite)
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(path.join(dir, "app.db"));
db.exec("PRAGMA foreign_keys = ON;");

const SCHEMA = fs.readFileSync(path.join(process.cwd(), "scripts", "schema.sql"), "utf8");
db.exec(SCHEMA);

const uid = () => crypto.randomUUID();
const run = (sql, ...p) => db.prepare(sql).run(...p);
const now = new Date();
const iso = (d) => d.toISOString();
const daysFromNow = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return iso(d).slice(0, 10); };

// Wipe (children first)
for (const t of ["HandoverLog","Booking","VehicleShare","ClubMembership","Club","GalleryImage","TimelineEvent","Document","Expense","Vehicle","User"]) {
  db.exec(`DELETE FROM ${t};`);
}

const hash = bcrypt.hashSync("password", 10);

// Users
const demo = uid(), friend = uid(), friend2 = uid();
run("INSERT INTO User (id,email,name,passwordHash) VALUES (?,?,?,?)", demo, "demo@mycollection.world", "Pham Khoi Nguyen", hash);
run("INSERT INTO User (id,email,name,passwordHash) VALUES (?,?,?,?)", friend, "alex@example.com", "Alex Rivera", hash);
run("INSERT INTO User (id,email,name,passwordHash) VALUES (?,?,?,?)", friend2, "sam@example.com", "Sam Becker", hash);

function vehicle(ownerId, year, make, model, imageUrl, opts = {}) {
  const id = uid();
  run(
    `INSERT INTO Vehicle
      (id,ownerId,year,make,model,imageUrl,cylinders,performanceKw,mileageKm,color,visibility,
       vehicleType,bodyStyle,previousOwners,unitsProduced,transmissionNumber,location,
       gearbox,driveType,driversSide,matchingNumbers,vin,keyFacts,overview)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, ownerId, year, make, model, imageUrl, opts.cylinders ?? null, opts.kw ?? null, opts.km ?? 0, opts.color ?? null, opts.visibility ?? "PRIVATE",
    opts.vehicleType ?? null, opts.bodyStyle ?? null, opts.previousOwners ?? null, opts.unitsProduced ?? null,
    opts.transmissionNumber ?? null, opts.location ?? null, opts.gearbox ?? null, opts.driveType ?? null,
    opts.driversSide ?? null, opts.matchingNumbers ? 1 : 0, opts.vin ?? null,
    opts.keyFacts ? JSON.stringify(opts.keyFacts) : null, opts.overview ?? null
  );
  return id;
}
function timeline(vid, year, title, desc, category = "HISTORY", eventDate = null) {
  run("INSERT INTO TimelineEvent (id,vehicleId,year,title,description,category,eventDate) VALUES (?,?,?,?,?,?,?)",
    uid(), vid, year, title, desc, category, eventDate);
}
function expense(vid, name, cat, amount, daysAgo) {
  const d = new Date(now); d.setDate(d.getDate() - daysAgo);
  run("INSERT INTO Expense (id,vehicleId,name,category,type,amount,date) VALUES (?,?,?,?,?,?,?)", uid(), vid, name, cat, "QUICK COST", amount, iso(d));
}
function doc(vid, name, cat, type, byId) {
  run("INSERT INTO Document (id,vehicleId,name,category,type,uploadedById) VALUES (?,?,?,?,?,?)", uid(), vid, name, cat, type, byId);
}
function gallery(vid, url, caption) {
  run("INSERT INTO GalleryImage (id,vehicleId,url,caption) VALUES (?,?,?,?)", uid(), vid, url, caption);
}

const IMG = {
  scirocco: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80",
  porsche: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=1200&q=80",
  defender: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1200&q=80",
  mustang: "https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?w=1200&q=80",
};

// Demo's cars
const scirocco = vehicle(demo, 2010, "Volkswagen", "Scirocco", IMG.scirocco, {
  cylinders: 4, kw: 118, km: 84210, color: "Silver / blue stripes",
  vehicleType: "STREETCAR", bodyStyle: "HATCHBACK", previousOwners: 1, unitsProduced: null,
  transmissionNumber: "02Q-DSG", location: "Munich, Germany",
  gearbox: "AUTOMATIC", driveType: "FRONT WHEEL DRIVE (FWD)", driversSide: "LEFT-HAND DRIVE (LHD)",
  matchingNumbers: true, vin: "WVWZZZ13ZAV001234",
  keyFacts: [
    "Revived in 2008 after a long hiatus as a sporty 2+2 coupe.",
    "Offered fuel-efficient TSI and torque-rich TDI engine options.",
    "Driver-focused interior with high-quality materials.",
    "Praised for agile handling and responsive steering.",
    "A modern reinterpretation of the iconic 1970s original.",
  ],
  overview: "The Volkswagen Scirocco is a sporty coupe that blends everyday usability with an engaging drive. Its aerodynamic silhouette emphasises a sporty character while the cabin keeps the driver at the centre. The 2010 model offered a broad engine range and remains a favourite among enthusiasts for its balance of style, efficiency and handling.",
});
timeline(scirocco, 2010, "The beginning", "This is the year the car was created.", "HISTORY");
timeline(scirocco, 2016, "Bought from first owner", "Acquired with full service history at 52,000 km.", "ADMIN");
timeline(scirocco, 2021, "Custom racing stripes", "Blue twin stripes added during a full detail.", "RESTORATION");
timeline(scirocco, 2025, "Major service due", "Cambelt and water pump service scheduled.", "SERVICE", daysFromNow(21));
expense(scirocco, "Annual service", "SERVICE", 300, 5);
expense(scirocco, "Insurance renewal", "INSURANCE", 640, 40);
expense(scirocco, "New tyres", "PARTS", 480, 120);
expense(scirocco, "Road tax", "TAX", 180, 60);
doc(scirocco, "Registration certificate", "REGISTRATION", "PDF", demo);
doc(scirocco, "Service invoice 2025", "INVOICE", "PDF", demo);
gallery(scirocco, IMG.scirocco, "Front three-quarter");

const porsche = vehicle(demo, 1989, "Porsche", "911 Carrera", IMG.porsche, {
  cylinders: 6, kw: 170, km: 132000, color: "Guards Red",
  vehicleType: "STREETCAR", bodyStyle: "COUPE", previousOwners: 3,
  gearbox: "MANUAL", driveType: "REAR WHEEL DRIVE (RWD)", driversSide: "LEFT-HAND DRIVE (LHD)",
  matchingNumbers: true, location: "Stuttgart, Germany",
  overview: "An air-cooled 911 Carrera — the last of the original 911 lineage before the 964. Revered for its mechanical purity, naturally-aspirated flat-six soundtrack and timeless silhouette.",
  keyFacts: ["Air-cooled 3.2L flat-six.", "Final year of the original 911 body (G-series).", "Manual G50 gearbox.", "An enduring collector favourite."],
});
timeline(porsche, 1989, "The beginning", "This is the year the car was created.", "HISTORY");
timeline(porsche, 2019, "Engine rebuild", "Top-end refresh and new clutch.", "SERVICE");
expense(porsche, "Engine rebuild", "SERVICE", 6200, 200);
expense(porsche, "Classic insurance", "INSURANCE", 950, 30);
expense(porsche, "Storage (winter)", "STORAGE", 600, 90);
doc(porsche, "Owner's manual", "MANUAL", "PDF", demo);
gallery(porsche, IMG.porsche, "Garage queen");

// Friend's cars
const defender = vehicle(friend, 1997, "Land Rover", "Defender 90", IMG.defender, { cylinders: 4, kw: 83, km: 210400, color: "Coniston Green" });
timeline(defender, 1997, "The beginning", "This is the year the car was created.");
expense(defender, "Clutch replacement", "SERVICE", 720, 80);

const mustang = vehicle(friend2, 1968, "Ford", "Mustang Fastback", IMG.mustang, { cylinders: 8, kw: 240, km: 98000, color: "Highland Green" });
timeline(mustang, 1968, "The beginning", "This is the year the car was created.");

// Club owned by demo, with friend + friend2 as members
const club = uid();
const invite = "GARAGE";
run(
  "INSERT INTO Club (id,name,description,ownerId,inviteCode,slug,primaryColor,tagline) VALUES (?,?,?,?,?,?,?,?)",
  club, "The Garage Collective", "Friends who share weekend cars", demo, invite,
  "the-garage", "#dc2626", "Friends who share weekend cars",
);
const addMember = (cid, userId, role) => run("INSERT INTO ClubMembership (id,clubId,userId,role) VALUES (?,?,?,?)", uid(), cid, userId, role);
addMember(club, demo, "OWNER");
addMember(club, friend, "MEMBER");
addMember(club, friend2, "MEMBER");

// Shares: demo shares Scirocco (approval), friend shares Defender (instant), friend2 shares Mustang (approval)
const share = (vid, requireApproval) => run("INSERT INTO VehicleShare (id,vehicleId,clubId,requireApproval) VALUES (?,?,?,?)", uid(), vid, club, requireApproval ? 1 : 0);
share(scirocco, true);
run("UPDATE Vehicle SET visibility='CLUB' WHERE id=?", scirocco);
share(defender, false);
run("UPDATE Vehicle SET visibility='CLUB' WHERE id=?", defender);
share(mustang, true);
run("UPDATE Vehicle SET visibility='CLUB' WHERE id=?", mustang);

// Bookings
const booking = (vid, borrowerId, start, end, status, purpose) => {
  const id = uid();
  run("INSERT INTO Booking (id,vehicleId,borrowerId,startDate,endDate,status,purpose) VALUES (?,?,?,?,?,?,?)", id, vid, borrowerId, start, end, status, purpose);
  return id;
};
// Incoming request for demo (friend wants the Scirocco)
booking(scirocco, friend, daysFromNow(7), daysFromNow(9), "PENDING", "Weekend road trip");
// Demo has an approved booking on the friend's Defender
const b2 = booking(defender, demo, daysFromNow(2), daysFromNow(4), "APPROVED", "Camping trip");
// Demo completed a past booking on the Mustang, with handover log
const b3 = booking(mustang, demo, daysFromNow(-10), daysFromNow(-8), "COMPLETED", "Cars & coffee");
run(
  "INSERT INTO HandoverLog (id,bookingId,pickupMileageKm,returnMileageKm,pickupFuelPct,returnFuelPct,checklistJson,pickedUpAt,returnedAt) VALUES (?,?,?,?,?,?,?,?,?)",
  uid(), b3, 97950, 98000, 90, 60, JSON.stringify(["Exterior walk-around photos taken","Documents and keys present"]), daysFromNow(-10), daysFromNow(-8)
);

console.log("Seeded demo data.");
console.log("Login: demo@mycollection.world / password");
console.log("Also: alex@example.com / password, sam@example.com / password");
console.log("Club invite code: " + invite);
db.close();
