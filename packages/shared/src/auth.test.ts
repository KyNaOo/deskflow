import { describe, expect, it } from 'vitest';
import { inviteUserSchema, loginSchema, registerCustomerSchema, registerTenantSchema } from './auth.js';

const validTenant = {
  organizationName: 'Acme Corp',
  slug: 'acme-corp',
  name: 'Alice',
  email: 'alice@acme.test',
  password: 'correct-horse-battery',
};

describe('registerTenantSchema', () => {
  it('normalise le slug et l’e-mail (espaces, majuscules) avant de les valider', () => {
    const result = registerTenantSchema.parse({
      ...validTenant,
      slug: '  Acme-Corp ',
      email: ' Alice@Acme.TEST ',
    });

    expect(result).toMatchObject({ slug: 'acme-corp', email: 'alice@acme.test' });
  });

  it.each(['ab', 'acme_corp', '-acme', 'acme--corp'])('refuse le slug %s', (slug) => {
    expect(registerTenantSchema.safeParse({ ...validTenant, slug }).success).toBe(false);
  });

  it('refuse un slug réservé par une route du front', () => {
    const result = registerTenantSchema.safeParse({ ...validTenant, slug: 'Login' });

    expect(result.error?.issues[0]?.message).toBe('Cet identifiant est réservé');
  });

  it('refuse un mot de passe trop court ou trop long', () => {
    expect(registerTenantSchema.safeParse({ ...validTenant, password: 'short' }).success).toBe(false);
    expect(
      registerTenantSchema.safeParse({ ...validTenant, password: 'a'.repeat(129) }).success,
    ).toBe(false);
  });

  it('refuse un champ inconnu', () => {
    const result = registerTenantSchema.safeParse({ ...validTenant, role: 'ADMIN' });

    expect(result.error?.issues[0]?.code).toBe('unrecognized_keys');
  });
});

describe('loginSchema', () => {
  it('accepte un mot de passe court (seul celui enregistré compte)', () => {
    expect(
      loginSchema.safeParse({ tenantSlug: 'acme', email: 'a@acme.test', password: 'x' }).success,
    ).toBe(true);
  });
});

describe('inviteUserSchema', () => {
  it('refuse d’inviter un client', () => {
    expect(inviteUserSchema.safeParse({ email: 'c@acme.test', role: 'CUSTOMER' }).success).toBe(
      false,
    );
  });
});

describe('registerCustomerSchema', () => {
  const customer = { tenantSlug: 'Acme', name: 'Chloé', email: 'chloe@client.test', password: 'correct-horse' };

  it('normalise le slug de l’organisation', () => {
    expect(registerCustomerSchema.parse(customer).tenantSlug).toBe('acme');
  });

  it('refuse un rôle fourni par le client', () => {
    expect(registerCustomerSchema.safeParse({ ...customer, role: 'ADMIN' }).success).toBe(false);
  });
});
