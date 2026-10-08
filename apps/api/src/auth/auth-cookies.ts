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
  const options: CookieOptions = { httpOnly: true, sameSite: 'lax', secure };

  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...options,
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });

  // Limité aux routes /auth : le refresh token ne voyage pas avec chaque requête
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...options,
    path: '/auth',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}
