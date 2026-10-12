import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApiError } from "./errors";

// Appels depuis le serveur Next.js (Server Components) : directement sur le réseau Docker
const API_URL = process.env.API_URL;

/**
 * Appel à l'API depuis un Server Component, avec les cookies de la requête du navigateur.
 * Un Server Component ne peut pas écrire de cookies : sur un 401, la session est renouvelée
 * côté navigateur par la page /refresh, qui renvoie ensuite vers l'accueil.
 * Une ressource introuvable (404, y compris celle d'un autre tenant) affiche la page « introuvable ».
 */
export async function serverFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Cookie: (await cookies()).toString() },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/refresh");
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw await ApiError.from(response);
  }
  return (await response.json()) as T;
}
