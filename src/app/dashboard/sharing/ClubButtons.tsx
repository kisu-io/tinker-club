"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import { createClub, joinClub } from "./actions";

export function CreateClubButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">Create club</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create a sharing club">
        <form action={createClub} className="space-y-4">
          <div>
            <label className="label">Club name</label>
            <input name="name" className="input" placeholder="e.g. The Garage Collective" required />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea name="description" className="input min-h-[70px]" placeholder="Friends & family who can borrow cars" />
          </div>
          <p className="text-xs text-ink-400">
            You&apos;ll get an invite code to share. Members can browse and book cars you&apos;ve shared into the club.
          </p>
          <SubmitButton pendingText="Creating…">Create club</SubmitButton>
        </form>
      </Modal>
    </>
  );
}

export function JoinClubButton() {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  async function action(fd: FormData) {
    const res = await joinClub(fd);
    if (res?.error) setErr(res.error);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost">Join with code</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Join a club">
        <form action={action} className="space-y-4">
          <div>
            <label className="label">Invite code</label>
            <input name="code" className="input uppercase tracking-widest" placeholder="ABC123" required />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <SubmitButton pendingText="Joining…">Join club</SubmitButton>
        </form>
      </Modal>
    </>
  );
}
