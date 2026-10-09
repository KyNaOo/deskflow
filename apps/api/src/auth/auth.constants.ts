export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 7;

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Tentatives de connexion / d'inscription autorisées par IP et par minute (anti-bruteforce). */
export const AUTH_RATE_LIMIT = { limit: 5, ttl: 60_000 };
