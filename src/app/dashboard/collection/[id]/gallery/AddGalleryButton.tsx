"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import { addGalleryImage } from "../detail-actions";

export function AddGalleryButton({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function action(fd: FormData) {
    await addGalleryImage(vehicleId, fd);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">Add Photo</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add photo">
        <form action={action} className="space-y-4">
          <div>
            <label className="label">Image URL</label>
            <input name="url" className="input" placeholder="https://…" required />
          </div>
          <div>
            <label className="label">Caption (optional)</label>
            <input name="caption" className="input" placeholder="e.g. At the track day" />
          </div>
          <SubmitButton pendingText="Saving…">Add photo</SubmitButton>
        </form>
      </Modal>
    </>
  );
}
