import type { Response } from 'supertest';

/** Renvoie l'en-tête Set-Cookie complet (valeur + attributs) du cookie demandé. */
export function getSetCookie(response: Response, name: string): string | undefined {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((cookie) => cookie.startsWith(`${name}=`));
}

/** Renvoie uniquement la valeur du cookie demandé. */
export function getCookieValue(response: Response, name: string): string | undefined {
  return getSetCookie(response, name)?.split(';')[0]?.slice(name.length + 1);
}
