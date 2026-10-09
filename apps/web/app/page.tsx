import { redirect } from "next/navigation";
import { serverFetch } from "@/lib/api/server";
import type { Profile } from "@/lib/api/types";

/** Accueil : renvoie vers l'espace de l'organisation de l'utilisateur connecté. */
export default async function Home() {
  const profile = await serverFetch<Profile>("/auth/me");
  redirect(`/${profile.tenant.slug}`);
}
