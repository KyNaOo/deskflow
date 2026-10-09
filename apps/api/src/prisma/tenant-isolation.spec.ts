import { scopeToTenant } from './tenant-isolation.js';

const TENANT = 'tenant-a';

describe('scopeToTenant', () => {
  it.each(['findMany', 'findFirst', 'findUnique', 'count', 'updateMany', 'deleteMany', 'delete'])(
    'ajoute le tenantId au where de %s',
    (operation) => {
      expect(scopeToTenant(operation, { where: { id: 'u1' } }, TENANT)).toEqual({
        where: { id: 'u1', tenantId: TENANT },
      });
    },
  );

  it('filtre aussi une requête sans where', () => {
    expect(scopeToTenant('findMany', {}, TENANT)).toEqual({ where: { tenantId: TENANT } });
  });

  it('écrase un tenantId fourni par l’appelant', () => {
    expect(scopeToTenant('findMany', { where: { tenantId: 'tenant-b' } }, TENANT)).toEqual({
      where: { tenantId: TENANT },
    });
  });

  it('ajoute le tenantId aux données d’une création', () => {
    expect(scopeToTenant('create', { data: { email: 'a@a.test' } }, TENANT)).toEqual({
      data: { email: 'a@a.test', tenantId: TENANT },
    });
  });

  it('ajoute le tenantId à chaque ligne d’un createMany', () => {
    const args = { data: [{ email: 'a@a.test' }, { email: 'b@b.test', tenantId: 'tenant-b' }] };
    expect(scopeToTenant('createMany', args, TENANT)).toEqual({
      data: [
        { email: 'a@a.test', tenantId: TENANT },
        { email: 'b@b.test', tenantId: TENANT },
      ],
    });
  });

  it('filtre le where et la création d’un upsert', () => {
    const args = { where: { id: 'u1' }, create: { email: 'a@a.test' }, update: { name: 'A' } };
    expect(scopeToTenant('upsert', args, TENANT)).toEqual({
      where: { id: 'u1', tenantId: TENANT },
      create: { email: 'a@a.test', tenantId: TENANT },
      update: { name: 'A' },
    });
  });

  it('refuse une opération qu’il ne sait pas filtrer', () => {
    expect(() => scopeToTenant('unknownOperation', {}, TENANT)).toThrow(/non gérée/);
  });
});
