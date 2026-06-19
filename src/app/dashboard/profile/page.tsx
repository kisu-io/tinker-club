import { requireUser } from "@/lib/auth";
import { Vehicles, Clubs, Bookings } from "@/lib/repo";
import { logoutAction } from "@/app/(auth)/actions";

export default async function ProfilePage() {
  const user = await requireUser();
  const cars = (await Vehicles.ownedBy(user.id)).length;
  const clubs = (await Clubs.forUser(user.id)).length;
  const bookings = (await Bookings.byBorrower(user.id)).length;
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-900 text-xl font-semibold text-white">
          {initials}
        </span>
        <div>
          <h1 className="text-xl font-semibold">{user.name}</h1>
          <p className="text-sm text-ink-500">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <p className="text-2xl font-semibold">{cars}</p>
          <p className="text-xs text-ink-500">Cars</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-semibold">{clubs}</p>
          <p className="text-xs text-ink-500">Clubs</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-semibold">{bookings}</p>
          <p className="text-xs text-ink-500">Bookings</p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-medium text-ink-700">Account</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-ink-500">Name</dt><dd>{user.name}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">Email</dt><dd>{user.email}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">Language</dt><dd>{user.language.toUpperCase()}</dd></div>
        </dl>
      </div>

      <form action={logoutAction}>
        <button type="submit" className="btn-ghost w-full">Sign out</button>
      </form>
    </div>
  );
}
