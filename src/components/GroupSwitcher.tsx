"use client";

import { useState } from "react";
import Link from "next/link";

interface GroupLink { slug: string; name: string }

export function GroupSwitcher({ groups }: { groups: GroupLink[] }) {
  const [open, setOpen] = useState(false);
  if (groups.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost text-xs"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Groups ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-lift"
          onMouseLeave={() => setOpen(false)}
        >
          {groups.map((g) => (
            <Link
              key={g.slug}
              role="menuitem"
              href={`/g/${g.slug}`}
              className="block px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"
              onClick={() => setOpen(false)}
            >
              {g.name}
            </Link>
          ))}
          <Link
            href="/dashboard/sharing"
            className="block border-t border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-900 hover:bg-ink-50"
            onClick={() => setOpen(false)}
          >
            Manage groups →
          </Link>
        </div>
      )}
    </div>
  );
}
