"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({
  action,
  confirm = "Delete this item?",
  label,
  className = "rounded-lg p-1.5 text-red-500 hover:bg-red-50",
}: {
  action: () => Promise<unknown>;
  confirm?: string;
  label?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      className={`${className} disabled:opacity-50`}
      onClick={() => {
        if (!window.confirm(confirm)) return;
        start(async () => {
          await action();
          router.refresh();
        });
      }}
    >
      {label ?? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
        </svg>
      )}
    </button>
  );
}
