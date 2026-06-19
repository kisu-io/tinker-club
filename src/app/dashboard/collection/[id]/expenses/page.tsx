import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Vehicles, Expenses, categoryTotals } from "@/lib/repo";
import { DonutChart } from "@/components/DonutChart";
import { DeleteButton } from "@/components/DeleteButton";
import { formatCurrency, formatDate } from "@/lib/format";
import { AddCostButton } from "./AddCostButton";
import { deleteExpense } from "../detail-actions";

export default async function ExpensesPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const v = await Vehicles.forOwner(params.id, user.id);
  if (!v) notFound();

  const expenses = await Expenses.forVehicle(v.id);
  const totals = await categoryTotals(v.id);
  const totalCost = totals.reduce((s, t) => s + t.total, 0);
  const years = Math.max(1, new Date().getFullYear() - v.year + 1);
  const avgAnnual = totalCost / years;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-500">Cost summary</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-card col-span-2">
              <p className="text-sm text-ink-500">Total Cost</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(totalCost, v.currency)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-ink-500">Total Entries</p>
              <p className="mt-1 text-2xl font-semibold">{expenses.length}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-ink-500">Average Annual Cost</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(avgAnnual, v.currency)}</p>
            </div>
          </div>
          <div className="stat-card flex items-center">
            <DonutChart data={totals} currency={v.currency} />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-500">All Entries</h2>
          <AddCostButton vehicleId={v.id} />
        </div>

        <div className="card overflow-hidden">
          {expenses.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-400">No expenses yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Category</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Date</th>
                  <th className="px-4 py-3 text-right font-medium">Cost</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-ink-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink-900">{e.name}</td>
                    <td className="hidden px-4 py-3 text-ink-500 sm:table-cell">{e.category}</td>
                    <td className="hidden px-4 py-3 text-ink-500 sm:table-cell">{formatDate(e.date)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(e.amount, v.currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <DeleteButton action={deleteExpense.bind(null, v.id, e.id)} confirm="Delete this expense?" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
