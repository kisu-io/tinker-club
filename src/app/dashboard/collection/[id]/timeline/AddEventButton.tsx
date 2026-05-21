"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import { addTimelineEvent } from "../detail-actions";

export function AddEventButton({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function action(fd: FormData) {
    await addTimelineEvent(vehicleId, fd);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost bg-white">Add Event</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add timeline event">
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Year</label>
              <input name="year" type="number" className="input" placeholder="2018" required />
            </div>
            <div className="col-span-2">
              <label className="label">Title</label>
              <input name="title" className="input" placeholder="e.g. Full respray" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select name="category" className="input" defaultValue="HISTORY">
                <option value="HISTORY">History</option>
                <option value="SERVICE">Service</option>
                <option value="RESTORATION">Restoration</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Date (optional)</label>
              <input name="eventDate" type="date" className="input" />
              <p className="mt-1 text-xs text-ink-400">Future dates appear under Upcoming events.</p>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea name="description" className="input min-h-[80px]" placeholder="What happened?" />
          </div>
          <div>
            <label className="label">Image URL (optional)</label>
            <input name="imageUrl" className="input" placeholder="https://…" />
          </div>
          <SubmitButton pendingText="Saving…">Add event</SubmitButton>
        </form>
      </Modal>
    </>
  );
}
