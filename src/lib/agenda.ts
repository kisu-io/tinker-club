import type { AgendaRow } from "./repo";

export type AgendaAction = "DECIDE" | "PICKUP" | "RETURN";
export type AgendaItem = AgendaRow & { role: "OWNER" | "BORROWER"; action: AgendaAction | null };

export interface Agenda {
  needsAction: AgendaItem[];
  upcoming: AgendaItem[];
  history: AgendaItem[];
}

/** What `uid` must do about a booking now, if anything (derived at render; no notifications table). */
function actionFor(b: AgendaRow, uid: string, today: string): AgendaAction | null {
  if (b.status === "PENDING") return b.ownerId === uid ? "DECIDE" : null;
  if (b.status !== "APPROVED") return null;
  if (!b.pickedUp) return b.startDate <= today ? "PICKUP" : null;
  return !b.returned && b.endDate <= today ? "RETURN" : null;
}

/** Split `uid`'s bookings (as borrower and as owner) into needs action / upcoming / history. */
export function buildAgenda(rows: AgendaRow[], uid: string, today: string): Agenda {
  const agenda: Agenda = { needsAction: [], upcoming: [], history: [] };
  for (const b of rows) {
    const item: AgendaItem = { ...b, role: b.ownerId === uid ? "OWNER" : "BORROWER", action: actionFor(b, uid, today) };
    if (item.action) agenda.needsAction.push(item);
    else if ((b.status === "PENDING" || b.status === "APPROVED") && b.endDate >= today) agenda.upcoming.push(item);
    else agenda.history.push(item);
  }
  agenda.history.reverse(); // most recent first
  return agenda;
}
