"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) console.error("[app/error]", error.digest);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-ink-500">
        Something went wrong
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900">
        We hit a bump in the road
      </h1>
      <p className="mt-3 text-sm text-ink-600">
        The page failed to render. You can try again, or head back to your collection.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/dashboard/collection" className="btn-ghost">
          Back to collection
        </Link>
      </div>
    </div>
  );
}
