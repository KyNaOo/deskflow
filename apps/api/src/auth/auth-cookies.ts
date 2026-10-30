import type { CookieOptions, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_DAYS,
} from './auth.constants.js';
import type { AuthTokens } from './token.service.js';

export interface AuthCookieSettings {
  /** HTTPS uniquement (production) */
  secure: boolean;
  /** Domaine partagé par le front et l'API en production ; absent : cookie limité à l'API */
  domain?: string;
}

/**
 * httpOnly : illisibles par le JavaScript de la page (protège contre le vol par XSS).
 * sameSite=lax : non envoyés par les requêtes POST venant d'un autre site (protège contre le CSRF).
 * secure : HTTPS uniquement, sauf en développement local.
 */
export function setAuthCookies(res: Response, tokens: AuthTokens, settings: AuthCookieSettings) {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...accessCookieOptions(settings),
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...refreshCookieOptions(settings),
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

/** Le navigateur n'efface un cookie que si le chemin et les attributs correspondent. */
export function clearAuthCookies(res: Response, settings: AuthCookieSettings) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, accessCookieOptions(settings));
  res.clearCookie(REFRESH_TOKEN_COOKIE, refreshCookieOptions(settings));
}

function accessCookieOptions({ secure, domain }: AuthCookieSettings): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, domain, path: '/' };
}

// Limité aux routes /auth : le refresh token ne voyage pas avec chaque requête
function refreshCookieOptions({ secure, domain }: AuthCookieSettings): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, domain, path: '/auth' };
}
