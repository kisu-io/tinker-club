"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { addDocument } from "../detail-actions";

export function AddDocumentButton({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function action(fd: FormData) {
    await addDocument(vehicleId, fd);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">Upload Documents</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add document">
        <form action={action} className="space-y-4">
          <div>
            <label className="label">Document name</label>
            <input name="name" className="input" placeholder="e.g. Registration certificate" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select name="category" className="input">
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select name="type" className="input">
                <option>PDF</option><option>IMAGE</option><option>DOC</option><option>LINK</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">File URL (optional)</label>
            <input name="fileUrl" className="input" placeholder="https://… or storage link" />
            <p className="mt-1 text-xs text-ink-400">
              Link to a file in your storage. Direct uploads can be wired to your object store.
            </p>
          </div>
          <SubmitButton pendingText="Saving…">Add document</SubmitButton>
        </form>
      </Modal>
    </>
  );
}
