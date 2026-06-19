import { notFound } from "next/navigation";
import { requireUser } from "./auth";
import { Clubs, Memberships } from "./repo";
import { checkGroupAccess } from "./group-access";
import type { Club, ClubMembership, User } from "./types";

// Re-export the pure helpers so callers can import everything from "./group".
export { checkGroupAccess } from "./group-access";
export type { GroupAccess } from "./group-access";

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
  const club = await Clubs.bySlug(slug);
  const membership = club ? await Memberships.of(club.id, user.id) : undefined;
  const access = checkGroupAccess(club, membership, user.id);
  if (!access.ok) notFound();
  return { user, club: club!, membership: membership!, isOwner: access.isOwner };
}
