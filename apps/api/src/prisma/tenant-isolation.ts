import type { Prisma } from '../generated/prisma/client.js';

/** Modèles portant un tenantId : toute requête sur eux est filtrée automatiquement. */
export const TENANT_SCOPED_MODELS: ReadonlySet<Prisma.ModelName> = new Set(['User']);

// Depuis Prisma 5, findUnique / update / delete acceptent des champs non uniques dans
// leur where : `{ id, tenantId }` reste valide et une ressource d'un autre tenant est
// simplement « introuvable ».
const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

const CREATE_MANY_OPERATIONS = new Set(['createMany', 'createManyAndReturn']);

type QueryArgs = Record<string, any>;

/**
 * Renvoie les arguments d'une requête Prisma restreints au tenant donné.
 * Les créations reçoivent le tenantId en clé étrangère scalaire : utiliser `customerId`
 * plutôt que `customer: { connect }`, que Prisma refuse de mélanger avec un scalaire.
 * Une opération inconnue lève une erreur : mieux vaut échouer que lire sans filtre.
 */
export function scopeToTenant(operation: string, args: QueryArgs, tenantId: string): QueryArgs {
  if (WHERE_OPERATIONS.has(operation)) {
    return { ...args, where: { ...args.where, tenantId } };
  }
  if (operation === 'create') {
    return { ...args, data: { ...args.data, tenantId } };
  }
  if (CREATE_MANY_OPERATIONS.has(operation)) {
    const rows: QueryArgs[] = Array.isArray(args.data) ? args.data : [args.data];
    return { ...args, data: rows.map((row) => ({ ...row, tenantId })) };
  }
  if (operation === 'upsert') {
    return {
      ...args,
      where: { ...args.where, tenantId },
      create: { ...args.create, tenantId },
    };
  }
  throw new Error(`Opération Prisma "${operation}" non gérée par l'isolation tenant`);
}
