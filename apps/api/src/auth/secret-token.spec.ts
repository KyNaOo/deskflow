import { generateSecretToken, hashSecretToken } from './secret-token.js';

describe('generateSecretToken', () => {
  it('génère des jetons de 256 bits encodés en base64url', () => {
    expect(generateSecretToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('ne génère jamais deux fois le même jeton', () => {
    const tokens = new Set(Array.from({ length: 100 }, generateSecretToken));
    expect(tokens.size).toBe(100);
  });
});

describe('hashSecretToken', () => {
  it('produit toujours la même empreinte pour un même jeton', () => {
    const token = generateSecretToken();
    expect(hashSecretToken(token)).toBe(hashSecretToken(token));
  });

  it('ne contient pas le jeton d’origine', () => {
    const token = generateSecretToken();
    expect(hashSecretToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSecretToken(token)).not.toContain(token);
  });
});
