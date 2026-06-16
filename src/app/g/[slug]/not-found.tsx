import Link from "next/link";

export default function GroupNotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink-900">Group not found</h1>
      <p className="mt-2 text-sm text-ink-500">
        This group doesn&apos;t exist, or you&apos;re not a member. Ask an owner for an invite code.
      </p>
      <Link href="/dashboard/sharing" className="btn-primary mt-6">Back to your groups</Link>
    </div>
  );
}
