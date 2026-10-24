import { requireUser } from "@/lib/auth";
import { Clubs, Bookings } from "@/lib/repo";
import { buildAgenda } from "@/lib/agenda";
import { todayUtc } from "@/lib/calendar";
import { TopNav, BottomNav } from "@/components/AppNav";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const groups = (await Clubs.forUser(user.id)).map((c) => ({ slug: c.slug, name: c.name }));
  // Derived at render (no notifications table): requests to answer, pickups and returns due.
  const needsAction = buildAgenda(await Bookings.agendaFor(user.id), user.id, todayUtc()).needsAction.length;
  return (
    <div className="min-h-screen bg-white">
      <TopNav initials={initialsOf(user.name)} groups={groups} needsAction={needsAction} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6 md:pb-12">{children}</main>
      <BottomNav needsAction={needsAction} />
    </div>
  );
}
