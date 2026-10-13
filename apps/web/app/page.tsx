import { redirect } from "next/navigation";
import { serverFetch } from "@/lib/api/server";
import type { Profile } from "@/lib/api/types";
import { homePath } from "@/lib/auth/paths";

/** Accueil : renvoie vers l'espace de l'utilisateur connecté (portail pour un client). */
export default async function Home() {
  const profile = await serverFetch<Profile>("/auth/me");
  redirect(homePath(profile.role, profile.tenant.slug));
}
