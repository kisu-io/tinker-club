"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import { createClub, joinClub } from "./actions";

export function CreateClubButton() {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  async function action(fd: FormData) {
    const res = await createClub(fd);
    if (res?.error) setErr(res.error);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">Create group</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create a car-share group">
        <form action={action} className="space-y-4">
          <div>
            <label className="label" htmlFor="cg-name">Group name</label>
            <input id="cg-name" name="name" className="input" placeholder="e.g. The Garage Collective" required />
          </div>
          <div>
            <label className="label" htmlFor="cg-desc">Description (optional)</label>
            <textarea id="cg-desc" name="description" className="input min-h-[70px]" placeholder="Friends & family who can borrow cars" />
          </div>
          <div>
            <label className="label" htmlFor="cg-slug">Group URL</label>
            <div className="flex items-center gap-1 text-sm text-ink-500">
              <span>/g/</span>
              <input
                id="cg-slug"
                name="slug"
                className="input"
                placeholder="mountain-drivers"
                pattern="[a-z0-9-]*"
                title="lowercase letters, numbers, and dashes only"
              />
            </div>
            <p className="mt-1 text-xs text-ink-400">Leave blank to auto-generate from the name. Must be unique.</p>
          </div>
          <div>
            <label className="label" htmlFor="cg-tagline">Tagline (optional)</label>
            <input id="cg-tagline" name="tagline" className="input" placeholder="Weekend canyon runs" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="cg-color">Primary color</label>
              <input id="cg-color" name="primaryColor" type="color" defaultValue="#dc2626" className="h-10 w-full rounded-xl border border-ink-200" />
            </div>
            <div className="flex-1">
              <label className="label" htmlFor="cg-accent">Accent (hover)</label>
              <input id="cg-accent" name="accentColor" type="color" defaultValue="#b91c1c" className="h-10 w-full rounded-xl border border-ink-200" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="cg-logo">Logo URL (optional)</label>
            <input id="cg-logo" name="logoUrl" className="input" placeholder="https://…/logo.png" />
          </div>
          <p className="text-xs text-ink-400">
            You&apos;ll get an invite code to share. Members can browse and book cars you&apos;ve shared into the group.
          </p>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <SubmitButton pendingText="Creating…">Create group</SubmitButton>
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
