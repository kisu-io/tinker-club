"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { addExpense } from "../detail-actions";

export function AddCostButton({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function action(fd: FormData) {
    await addExpense(vehicleId, fd);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">Add Cost</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add cost">
        <form action={action} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input name="name" className="input" placeholder="e.g. Annual service" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select name="category" className="input">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount (EUR)</label>
              <input name="amount" type="number" step="0.01" className="input" placeholder="300.00" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select name="type" className="input">
                <option>QUICK COST</option>
                <option>RECURRING</option>
                <option>ONE-TIME</option>
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input name="date" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input name="notes" className="input" placeholder="Optional" />
          </div>
          <SubmitButton pendingText="Saving…">Add Cost</SubmitButton>
        </form>
      </Modal>
    </>
  );
}
