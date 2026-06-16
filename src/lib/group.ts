import { notFound } from "next/navigation";
import { requireUser } from "./auth";
import { Clubs, Memberships } from "./repo";
import type { Club, ClubMembership, User } from "./types";

export type GroupAccess =
  | { ok: true; isOwner: boolean }
  | { ok: false; reason: "not-found" | "not-member" };

/** Pure authorization decision — unit tested. */
export function checkGroupAccess(
  club: Club | undefined,
  membership: ClubMembership | undefined,
  userId: string,
): GroupAccess {
  if (!club) return { ok: false, reason: "not-found" };
  if (!membership) return { ok: false, reason: "not-member" };
  return { ok: true, isOwner: club.ownerId === userId };
}

export interface GroupContext {
  user: User;
  club: Club;
  membership: ClubMembership;
  isOwner: boolean;
}

/**
 * Resolve a group by slug and authorize the current user as a member.
 * Call this at the top of every /g/[slug] server component / action.
 * Non-members get a 404 (we do not reveal that the group exists).
 */
export async function requireGroupMember(slug: string): Promise<GroupContext> {
  const user = await requireUser();
  const club = Clubs.bySlug(slug);
  const membership = club ? Memberships.of(club.id, user.id) : undefined;
  const access = checkGroupAccess(club, membership, user.id);
  if (!access.ok) notFound();
  return { user, club: club!, membership: membership!, isOwner: access.isOwner };
}
