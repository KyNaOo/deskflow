import { validateEnv } from './env.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/deskflow',
  JWT_SECRET: 'a'.repeat(32),
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://s3:8333',
  S3_PUBLIC_URL: 'http://localhost:8333',
  S3_BUCKET: 'attachments',
  S3_ACCESS_KEY: 'key',
  S3_SECRET_KEY: 'secret',
  SMTP_URL: 'smtp://localhost:1025',
  WEB_URL: 'http://localhost:3000',
};

describe('validateEnv', () => {
  it('accepte un environnement valide et applique les valeurs par défaut', () => {
    expect(validateEnv(validEnv)).toEqual({
      NODE_ENV: 'development',
      PORT: 3001,
      DATABASE_URL: validEnv.DATABASE_URL,
      JWT_SECRET: validEnv.JWT_SECRET,
      REDIS_URL: validEnv.REDIS_URL,
      QUEUE_PREFIX: 'deskflow',
      S3_ENDPOINT: validEnv.S3_ENDPOINT,
      S3_PUBLIC_URL: validEnv.S3_PUBLIC_URL,
      S3_REGION: 'us-east-1',
      S3_BUCKET: validEnv.S3_BUCKET,
      S3_ACCESS_KEY: validEnv.S3_ACCESS_KEY,
      S3_SECRET_KEY: validEnv.S3_SECRET_KEY,
      SMTP_URL: validEnv.SMTP_URL,
      WEB_URL: validEnv.WEB_URL,
      TRUST_PROXY: false,
    });
  });

  it('lit les réglages de production derrière un reverse proxy', () => {
    const env = validateEnv({ ...validEnv, COOKIE_DOMAIN: 'demo.duckdns.org', TRUST_PROXY: 'true' });

    expect(env).toMatchObject({ COOKIE_DOMAIN: 'demo.duckdns.org', TRUST_PROXY: true });
  });

  it('ignore un COOKIE_DOMAIN vide (variable présente mais non renseignée)', () => {
    expect(validateEnv({ ...validEnv, COOKIE_DOMAIN: '' }).COOKIE_DOMAIN).toBeUndefined();
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
