import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";

export default function Home() {
  const uid = getSessionUserId();
  redirect(uid ? "/dashboard/collection" : "/login");
}
