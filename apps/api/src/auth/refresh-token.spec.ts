import { generateRefreshToken, hashRefreshToken } from './refresh-token.js';

describe('generateRefreshToken', () => {
  it('génère des jetons de 256 bits encodés en base64url', () => {
    expect(generateRefreshToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('ne génère jamais deux fois le même jeton', () => {
    const tokens = new Set(Array.from({ length: 100 }, generateRefreshToken));
    expect(tokens.size).toBe(100);
  });
});

describe('hashRefreshToken', () => {
  it('produit toujours la même empreinte pour un même jeton', () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it('ne contient pas le jeton d’origine', () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRefreshToken(token)).not.toContain(token);
  });
});
