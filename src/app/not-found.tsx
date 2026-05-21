import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-ink-500">
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900">
        Page not found
      </h1>
      <p className="mt-3 text-sm text-ink-600">
        We couldn&apos;t find what you&apos;re looking for. The page may have moved or
        never existed.
      </p>
      <Link href="/dashboard/collection" className="btn-primary mt-6">
        Back to your collection
      </Link>
    </div>
  );
}
