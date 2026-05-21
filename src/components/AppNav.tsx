"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { CarIcon, WalletIcon, ShareIcon, UserIcon } from "./icons";

const items = [
  { href: "/dashboard/collection", label: "Collection", icon: CarIcon },
  { href: "/dashboard/expense-manager", label: "Expense Manager", icon: WalletIcon },
  { href: "/dashboard/sharing", label: "Sharing", icon: ShareIcon },
  { href: "/dashboard/profile", label: "Profile", icon: UserIcon },
];

function isActive(pathname: string, href: string) {
  if (href.endsWith("/collection")) return pathname.startsWith("/dashboard/collection");
  return pathname.startsWith(href);
}

export function TopNav({ initials }: { initials: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 hidden border-b border-ink-100 bg-white/90 backdrop-blur md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/dashboard/collection">
          <Logo />
        </Link>
        <nav className="flex items-center gap-7 text-sm">
          {items.slice(0, 3).map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={
                isActive(pathname, it.href)
                  ? "font-semibold text-ink-900"
                  : "text-ink-500 hover:text-ink-800"
              }
            >
              {it.label}
            </Link>
          ))}
          <Link
            href="/dashboard/profile"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700"
          >
            {initials}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((it) => {
          const Icon = it.icon;
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                active ? "text-ink-900" : "text-ink-400"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.1]" : ""}`} />
              <span className="font-medium">{it.label === "Expense Manager" ? "Expenses" : it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
