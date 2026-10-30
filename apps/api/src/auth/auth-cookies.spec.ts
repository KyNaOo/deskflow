import type { Response } from 'express';
import { clearAuthCookies, setAuthCookies } from './auth-cookies.js';

function fakeResponse() {
  return { cookie: vi.fn(), clearCookie: vi.fn() };
}

const tokens = { accessToken: 'access', refreshToken: 'refresh' };

describe('cookies de session', () => {
  it('en local : cookies limités à l’API, sans HTTPS ni domaine', () => {
    const res = fakeResponse();

    setAuthCookies(res as unknown as Response, tokens, { secure: false });

    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'access',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', secure: false, domain: undefined, path: '/' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh',
      expect.objectContaining({ httpOnly: true, secure: false, domain: undefined, path: '/auth' }),
    );
  });

  it('en production : HTTPS et domaine partagé par le front et l’API', () => {
    const res = fakeResponse();
    const settings = { secure: true, domain: 'demo.duckdns.org' };

    setAuthCookies(res as unknown as Response, tokens, settings);
    clearAuthCookies(res as unknown as Response, settings);

    for (const name of ['access_token', 'refresh_token']) {
      expect(res.cookie).toHaveBeenCalledWith(
        name,
        expect.any(String),
        expect.objectContaining({ secure: true, domain: 'demo.duckdns.org' }),
      );
      // Sans le même domaine, le navigateur n'effacerait pas le cookie à la déconnexion
      expect(res.clearCookie).toHaveBeenCalledWith(
        name,
        expect.objectContaining({ secure: true, domain: 'demo.duckdns.org' }),
      );
    }
  });
});
