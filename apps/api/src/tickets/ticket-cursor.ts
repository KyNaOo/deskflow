import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * Pagination par curseur : la page suivante reprend juste après le dernier ticket vu, dans
 * l'ordre (updatedAt décroissant, puis id pour départager les égalités). Contrairement à un
 * OFFSET, PostgreSQL ne relit pas les pages précédentes, et un ticket créé entre deux pages ne
 * décale pas la liste. Le curseur est opaque pour le client : base64url de ces deux valeurs.
 */
export interface TicketCursor {
  updatedAt: Date;
  id: string;
}

const cursorSchema = z.object({ updatedAt: z.iso.datetime(), id: z.uuid() });

export const TICKET_LIST_ORDER = [
  { updatedAt: 'desc' },
  { id: 'desc' },
] satisfies Prisma.TicketOrderByWithRelationInput[];

export function encodeCursor({ updatedAt, id }: TicketCursor): string {
  return Buffer.from(JSON.stringify({ updatedAt: updatedAt.toISOString(), id })).toString('base64url');
}

export function decodeCursor(cursor: string): TicketCursor {
  try {
    const { updatedAt, id } = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
    return { updatedAt: new Date(updatedAt), id };
  } catch {
    throw new BadRequestException('cursor : curseur invalide');
  }
}

/** Tickets situés après le curseur dans l'ordre de la liste. */
export function afterCursor({ updatedAt, id }: TicketCursor): Prisma.TicketWhereInput {
  return {
    OR: [{ updatedAt: { lt: updatedAt } }, { updatedAt, id: { lt: id } }],
  };
}
