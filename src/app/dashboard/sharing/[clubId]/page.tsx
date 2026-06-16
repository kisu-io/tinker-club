import { redirect, notFound } from "next/navigation";
import { Clubs } from "@/lib/repo";

// Legacy URL — groups now live at /g/<slug>. Redirect old bookmarks/links.
export default function LegacyClubRedirect({ params }: { params: { clubId: string } }) {
  const club = Clubs.byId(params.clubId);
  if (!club) notFound();
  redirect(`/g/${club.slug}`);
}
