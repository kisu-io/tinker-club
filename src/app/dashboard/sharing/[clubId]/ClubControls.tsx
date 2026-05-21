"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveClub } from "../actions";

export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="pill bg-ink-900 text-white"
      title="Copy invite code"
    >
      Invite code: <span className="tracking-widest">{code}</span>
      <span className="ml-1 text-white/70">{copied ? "✓ copied" : "⧉"}</span>
    </button>
  );
}

export function LeaveClubButton({ clubId }: { clubId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => { if (confirm("Leave this club?")) start(async () => { await leaveClub(clubId); router.refresh(); }); }}
      className="btn-ghost text-xs disabled:opacity-50"
    >
      Leave club
    </button>
  );
}
