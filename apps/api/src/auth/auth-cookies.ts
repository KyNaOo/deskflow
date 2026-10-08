import type { CookieOptions, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_DAYS,
} from './auth.constants.js';
import type { AuthTokens } from './token.service.js';

/**
 * httpOnly : illisibles par le JavaScript de la page (protège contre le vol par XSS).
 * sameSite=lax : non envoyés par les requêtes POST venant d'un autre site (protège contre le CSRF).
 * secure : HTTPS uniquement, sauf en développement local.
 */
export function setAuthCookies(res: Response, tokens: AuthTokens, secure: boolean) {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...accessCookieOptions(secure),
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...refreshCookieOptions(secure),
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

/** Le navigateur n'efface un cookie que si le chemin et les attributs correspondent. */
export function clearAuthCookies(res: Response, secure: boolean) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, accessCookieOptions(secure));
  res.clearCookie(REFRESH_TOKEN_COOKIE, refreshCookieOptions(secure));
}

function accessCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
}

// Limité aux routes /auth : le refresh token ne voyage pas avec chaque requête
function refreshCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/auth' };
}
