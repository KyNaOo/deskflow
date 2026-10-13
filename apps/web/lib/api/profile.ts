import { cache } from "react";
import { serverFetch, serverFetchIfSignedIn } from "./server";
import type { Profile } from "./types";

/**
 * Profil de l'utilisateur connecté, lu une seule fois par requête même si le layout et la page
 * le demandent tous les deux (React.cache).
 */
export const getProfile = cache(() => serverFetch<Profile>("/auth/me"));

/** Même chose sur une page publique : `null` si personne n'est connecté. */
export const getOptionalProfile = cache(() => serverFetchIfSignedIn<Profile>("/auth/me"));
