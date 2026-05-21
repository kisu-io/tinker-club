import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full md:grid md:grid-cols-2">
      <div className="flex min-h-screen flex-col justify-center px-6 py-12 md:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10">
            <Logo />
          </div>
          {children}
        </div>
      </div>
      {/* Hero panel — classic car gradient (right side on desktop) */}
      <div className="relative hidden md:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#3a1414] via-[#7a2d2d] to-[#0f172a]" />
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.25),transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.15),transparent_45%)]" />
        <div className="absolute bottom-10 left-10 right-10 text-white/90">
          <p className="text-2xl font-semibold leading-snug">
            Every car has a story.
          </p>
          <p className="mt-2 max-w-md text-white/70">
            Track its history, value, maintenance and documents — and share it
            with the people you trust.
          </p>
        </div>
      </div>
    </div>
  );
}
