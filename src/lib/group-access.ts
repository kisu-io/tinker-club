import type { Club, ClubMembership } from "./types";

// Pure group authorization logic — deliberately free of any Next.js imports so
// it can be unit-tested without the Next runtime. The Next-coupled resolver
// (requireGroupMember) lives in ./group and builds on this.

export type GroupAccess =
  | { ok: true; isOwner: boolean }
  | { ok: false; reason: "not-found" | "not-member" };

/** Pure authorization decision. */
export function checkGroupAccess(
  club: Club | undefined,
  membership: ClubMembership | undefined,
  userId: string,
): GroupAccess {
  if (!club) return { ok: false, reason: "not-found" };
  if (!membership) return { ok: false, reason: "not-member" };
  return { ok: true, isOwner: club.ownerId === userId };
}
