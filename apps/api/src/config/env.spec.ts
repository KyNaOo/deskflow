import { validateEnv } from './env.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/deskflow',
  JWT_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('accepte un environnement valide et applique les valeurs par défaut', () => {
    expect(validateEnv(validEnv)).toEqual({
      NODE_ENV: 'development',
      PORT: 3001,
      DATABASE_URL: validEnv.DATABASE_URL,
      JWT_SECRET: validEnv.JWT_SECRET,
    });
  });

  it('convertit PORT en nombre', () => {
    expect(validateEnv({ ...validEnv, PORT: '4000' }).PORT).toBe(4000);
  });

  it('refuse un environnement sans DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuse une DATABASE_URL qui n’est pas une URL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'not-a-url' })).toThrow(/DATABASE_URL/);
  });

  it('refuse un JWT_SECRET trop court', () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('refuse un NODE_ENV inconnu', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
