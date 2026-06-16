import Link from "next/link";
import type { CSSProperties } from "react";
import { requireGroupMember } from "@/lib/group";

// Derive a darker hover shade by reusing the same hex; good enough for branding.
function brandStyle(primary: string | null, accent: string | null): CSSProperties {
  const main = primary ?? "#dc2626";
  return {
    ["--group-accent" as string]: main,
    ["--group-accent-strong" as string]: accent ?? main,
  };
}

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const { club } = await requireGroupMember(params.slug);

  return (
    <div className="min-h-screen bg-white" style={brandStyle(club.primaryColor, club.accentColor)}>
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            {club.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={club.logoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
                style={{ backgroundColor: "var(--group-accent)" }}
              >
                {club.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink-900">{club.name}</p>
              {club.tagline && <p className="text-xs text-ink-500">{club.tagline}</p>}
            </div>
          </div>
          <Link href="/dashboard/collection" className="text-sm text-ink-500 hover:text-ink-900">
            ← My garage
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6 md:pb-12">{children}</main>
    </div>
  );
}
