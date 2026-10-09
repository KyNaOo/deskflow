import { safeNextPath } from "@/lib/safe-next-path";
import { SessionRefresher } from "./session-refresher";

/**
 * Étape intermédiaire quand l'access token a expiré : le refresh token n'est envoyé qu'aux
 * routes /auth de l'API, seul le navigateur peut donc renouveler la session.
 */
export default async function RefreshPage({ searchParams }: PageProps<"/refresh">) {
  const { next } = await searchParams;
  return <SessionRefresher next={safeNextPath(next)} />;
}
