export const EXPENSE_CATEGORIES = [
  "SERVICE",
  "INSURANCE",
  "FUEL",
  "TAX",
  "PURCHASE",
  "PARTS",
  "STORAGE",
  "OTHER",
] as const;

export const DOCUMENT_CATEGORIES = [
  "REGISTRATION",
  "INSURANCE",
  "INVOICE",
  "MANUAL",
  "WARRANTY",
  "OTHER",
] as const;

// Colors used for category donut segments (slate-based palette + accent)
export const CATEGORY_COLORS: Record<string, string> = {
  SERVICE: "#64748b",
  INSURANCE: "#0f172a",
  FUEL: "#94a3b8",
  TAX: "#334155",
  PURCHASE: "#7c5cff",
  PARTS: "#475569",
  STORAGE: "#cbd5e1",
  OTHER: "#e2e8f0",
};

export const DEFAULT_HANDOVER_CHECKLIST = [
  "Exterior walk-around photos taken",
  "Interior clean and undamaged",
  "Tyres and pressure checked",
  "Fluids and warning lights OK",
  "Documents and keys present",
];
