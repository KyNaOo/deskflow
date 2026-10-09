import { ApiError } from "./errors";

// Appels depuis le navigateur : les cookies httpOnly de session partent avec chaque requête
// (credentials: "include"), le JavaScript de la page ne les lit jamais.
const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface ApiRequest {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Renouvelle la session (nouvel access token + nouveau refresh token).
 * Un seul appel à la fois : les requêtes qui reçoivent un 401 en même temps attendent la même
 * promesse. Deux refresh simultanés présenteraient le même jeton, ce que l'API traite comme un
 * vol et sanctionne en révoquant la session.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * Appel à l'API avec refresh transparent : sur un 401, la session est renouvelée puis la
 * requête rejouée une seule fois. Si le renouvellement échoue, retour à la page de connexion.
 */
export async function apiFetch<T = void>(path: string, request: ApiRequest = {}): Promise<T> {
  let response = await send(path, request);

  // Les routes /auth répondent 401 pour de mauvais identifiants : rien à renouveler
  if (response.status === 401 && !path.startsWith("/auth/")) {
    if (await refreshSession()) {
      response = await send(path, request);
    } else {
      // Rechargement complet voulu : aucune donnée de l'ancienne session ne reste en mémoire
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }

  if (!response.ok) {
    throw await ApiError.from(response);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

function send(path: string, { method = "GET", json }: ApiRequest): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: json === undefined ? undefined : { "Content-Type": "application/json" },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
}
