"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface GroupLink { slug: string; name: string }

export function GroupSwitcher({ groups }: { groups: GroupLink[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape or a click outside (expected ARIA menu keyboard behavior).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (groups.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
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
