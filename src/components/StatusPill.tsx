import type { BookingStatus } from "@/lib/types";

const map: Record<BookingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  DECLINED: "bg-red-100 text-red-700",
  CANCELLED: "bg-ink-100 text-ink-500",
  COMPLETED: "bg-sky-100 text-sky-700",
};

export function StatusPill({ status }: { status: BookingStatus }) {
  return <span className={`pill ${map[status]}`}>{status[0] + status.slice(1).toLowerCase()}</span>;
}
