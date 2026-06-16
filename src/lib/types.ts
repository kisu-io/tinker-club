export type Visibility = "PRIVATE" | "CLUB" | "PUBLIC";
export type BookingStatus = "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED" | "COMPLETED";
export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";
export type TimelineCategory = "SERVICE" | "RESTORATION" | "ADMIN" | "HISTORY";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  language: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  ownerId: string;
  year: number;
  make: string;
  model: string;
  imageUrl: string | null;
  cylinders: number | null;
  performanceKw: number | null;
  mileageKm: number;
  vin: string | null;
  color: string | null;
  description: string | null;
  visibility: Visibility;
  currency: string;
  vehicleType: string | null;
  bodyStyle: string | null;
  previousOwners: number | null;
  unitsProduced: number | null;
  transmissionNumber: string | null;
  location: string | null;
  gearbox: string | null;
  driveType: string | null;
  driversSide: string | null;
  matchingNumbers: number;
  keyFacts: string | null;
  overview: string | null;
  createdAt: string;
}

export interface Expense {
  id: string;
  vehicleId: string;
  name: string;
  category: string;
  type: string;
  amount: number;
  date: string;
  notes: string | null;
}

export interface DocumentRow {
  id: string;
  vehicleId: string;
  name: string;
  category: string;
  type: string;
  fileUrl: string | null;
  uploadedById: string | null;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  vehicleId: string;
  year: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: TimelineCategory;
  eventDate: string | null;
  createdAt: string;
}

export interface GalleryImage {
  id: string;
  vehicleId: string;
  url: string;
  caption: string | null;
  createdAt: string;
}

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

export interface ClubMembership {
  id: string;
  clubId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
}

export interface VehicleShare {
  id: string;
  vehicleId: string;
  clubId: string;
  requireApproval: number;
  notes: string | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  vehicleId: string;
  borrowerId: string;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  purpose: string | null;
  createdAt: string;
}

export interface HandoverLog {
  id: string;
  bookingId: string;
  pickupMileageKm: number | null;
  returnMileageKm: number | null;
  pickupFuelPct: number | null;
  returnFuelPct: number | null;
  conditionNotes: string | null;
  damageReported: number;
  checklistJson: string | null;
  pickedUpAt: string | null;
  returnedAt: string | null;
  updatedAt: string;
}
