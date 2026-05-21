import { requireUser } from "@/lib/auth";
import { TopNav, BottomNav } from "@/components/AppNav";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-white">
      <TopNav initials={initialsOf(user.name)} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6 md:pb-12">{children}</main>
      <BottomNav />
    </div>
  );
}
