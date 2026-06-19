import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Clubs, Memberships } from "@/lib/repo";

// Legacy URL — groups now live at /g/<slug>. Redirect old bookmarks/links, but
// ONLY for members: a non-member must get a 404 so this shim can't be used as an
// oracle to confirm a club id exists or to learn its (name-derived) slug.
export default async function LegacyClubRedirect({ params }: { params: { clubId: string } }) {
  const user = await requireUser();
  const club = await Clubs.byId(params.clubId);
  const membership = club ? await Memberships.of(club.id, user.id) : undefined;
  if (!club || !membership) notFound();
  redirect(`/g/${club.slug}`);
}
