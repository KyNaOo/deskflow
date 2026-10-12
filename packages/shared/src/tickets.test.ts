import { describe, expect, it } from 'vitest';
import { createTicketSchema, listTicketsQuerySchema, updateTicketSchema } from './tickets.js';

describe('createTicketSchema', () => {
  it('accepte un ticket minimal et retire les espaces superflus', () => {
    expect(createTicketSchema.parse({ subject: '  Imprimante HS ', message: 'Elle ne répond plus' })).toEqual({
      subject: 'Imprimante HS',
      message: 'Elle ne répond plus',
    });
  });

  it('refuse un sujet vide ou trop long', () => {
    expect(createTicketSchema.safeParse({ subject: '   ', message: 'x' }).success).toBe(false);
    expect(createTicketSchema.safeParse({ subject: 'a'.repeat(201), message: 'x' }).success).toBe(false);
  });

  it('refuse une priorité inconnue et un customerId qui n’est pas un UUID', () => {
    expect(createTicketSchema.safeParse({ subject: 'a', message: 'b', priority: 'CRITICAL' }).success).toBe(false);
    expect(createTicketSchema.safeParse({ subject: 'a', message: 'b', customerId: '42' }).success).toBe(false);
  });
});

describe('updateTicketSchema', () => {
  it('accepte une modification partielle, et null pour désassigner', () => {
    expect(updateTicketSchema.parse({ status: 'RESOLVED' })).toEqual({ status: 'RESOLVED' });
    expect(updateTicketSchema.parse({ assigneeId: null })).toEqual({ assigneeId: null });
  });

  it('refuse une modification vide', () => {
    expect(updateTicketSchema.safeParse({}).error?.issues[0]?.message).toBe('Aucune modification demandée');
  });

  it('refuse un statut inconnu', () => {
    expect(updateTicketSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(false);
  });
});

describe('listTicketsQuerySchema', () => {
  it('applique la taille de page par défaut et ignore les filtres vides', () => {
    expect(listTicketsQuerySchema.parse({ status: '', q: '' })).toEqual({ limit: 20 });
  });

  it('convertit limit (chaîne de l’URL) en nombre, dans les bornes', () => {
    expect(listTicketsQuerySchema.parse({ limit: '5' }).limit).toBe(5);
    expect(listTicketsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(listTicketsQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
  });

  it('accepte me, none ou un UUID comme assigné', () => {
    expect(listTicketsQuerySchema.parse({ assignee: 'me' }).assignee).toBe('me');
    expect(listTicketsQuerySchema.parse({ assignee: 'none' }).assignee).toBe('none');
    expect(listTicketsQuerySchema.safeParse({ assignee: 'bob' }).success).toBe(false);
  });

  it('refuse un paramètre inconnu', () => {
    expect(listTicketsQuerySchema.safeParse({ sort: 'asc' }).success).toBe(false);
  });
});
