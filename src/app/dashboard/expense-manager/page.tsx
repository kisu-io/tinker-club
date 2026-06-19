import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Vehicles, categoryTotalsForOwner, vehicleCostTotals, categoryTotalsForVehicles } from "@/lib/repo";
import { DonutChart } from "@/components/DonutChart";
import { VehicleImage } from "@/components/VehicleImage";
import { formatCurrency } from "@/lib/format";
import { CATEGORY_COLORS } from "@/lib/constants";

export default async function ExpenseManagerPage() {
  const user = await requireUser();
  const vehicles = await Vehicles.ownedBy(user.id);
  const totals = await categoryTotalsForOwner(user.id);
  const grand = totals.reduce((s, t) => s + t.total, 0);
  const perCar = new Map((await vehicleCostTotals(user.id)).map((r) => [r.vehicleId, r.total]));
  const avgAnnual = vehicles.length ? grand / vehicles.length : 0;
  // Bulk fetch category totals for all vehicles in one query (no N+1).
  const allCats = await categoryTotalsForVehicles(vehicles.map((v) => v.id));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Cost summary</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-card col-span-2">
              <p className="text-sm text-ink-500">Total Cost</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(grand)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-ink-500">Cars Owned</p>
              <p className="mt-1 text-2xl font-semibold">{vehicles.length}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-ink-500">Average Cost / Car</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(avgAnnual)}</p>
            </div>
          </div>
          <div className="stat-card flex items-center">
            <DonutChart data={totals} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Cost per car</h2>
        {vehicles.length === 0 ? (
          <div className="card p-10 text-center text-sm text-ink-400">No cars in your collection yet.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => {
              const cats = allCats[v.id] ?? [];
              const total = perCar.get(v.id) ?? 0;
              return (
                <div key={v.id} className="card overflow-hidden">
                  <VehicleImage src={v.imageUrl} alt={`${v.make} ${v.model}`} className="h-40 w-full" />
                  <div className="p-4">
                    <p className="text-xs text-ink-400">{v.year} · {v.make} {v.model}</p>
                    <p className="mt-1 text-xl font-semibold">{formatCurrency(total, v.currency)}</p>
                    <div className="mt-3 space-y-1.5 text-sm">
                      {cats.slice(0, 4).map((c) => (
                        <div key={c.category} className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-ink-600">
                            <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[c.category] ?? "#94a3b8" }} />
                            {c.category}
                          </span>
                          <span>{formatCurrency(c.total, v.currency)}</span>
                        </div>
                      ))}
                      {cats.length === 0 && <p className="text-ink-400">No expenses logged.</p>}
                    </div>
                    <Link href={`/dashboard/collection/${v.id}/expenses`} className="mt-3 inline-block text-sm font-medium text-ink-700 hover:underline">
                      See Details →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
