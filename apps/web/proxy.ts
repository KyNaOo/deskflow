import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/auth/paths";

const ACCESS_TOKEN_COOKIE = "access_token";

/**
 * Redirection optimiste des pages privées : sans cookie de session, inutile d'afficher la page.
 * Simple confort : le cookie n'est pas vérifié ici, la sécurité reste dans l'API.
 * Le cookie d'accès expire avec son JWT (15 min) : on passe alors par /refresh, qui tente de
 * renouveler la session avant de renvoyer vers la bonne page de connexion.
 */
export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname) || request.cookies.has(ACCESS_TOKEN_COOKIE)) {
    return NextResponse.next();
  }

  const refreshUrl = new URL("/refresh", request.url);
  refreshUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(refreshUrl);
}

export const config = {
  // Toutes les pages sauf les fichiers statiques ; les pages publiques sont filtrées par isPublicPath
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
