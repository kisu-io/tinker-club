"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { deleteVehicle } from "../actions";
import type { BlockingBooking } from "@/lib/repo";

export function DeleteCarButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<BlockingBooking[]>([]);

  function close() {
    setOpen(false);
    setError(null);
    setBlocking([]);
  }

  function confirmDelete() {
    start(async () => {
      // On success the action redirects, so a return value always means refusal.
      const res = await deleteVehicle(id);
      if (res && !res.ok) {
        setError(res.error);
        setBlocking(res.blocking ?? []);
      }
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50">
        Delete car
      </button>
      <Modal open={open} onClose={close} title="Delete this car?">
        <p className="text-sm text-ink-700">
          <span className="font-semibold">{title}</span> and all of its gallery, documents, expenses, timeline and
          club sharing will be permanently deleted. This cannot be undone.
        </p>
        {error && (
          <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p>{error}</p>
            {blocking.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {blocking.map((b) => (
                  <li key={b.id}>
                    {b.borrowerName}: {b.startDate} → {b.endDate} ({b.status.toLowerCase()})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={close} className="btn-ghost">Cancel</button>
          <button
            onClick={confirmDelete}
            disabled={pending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete car"}
          </button>
        </div>
      </Modal>
    </>
  );
}
