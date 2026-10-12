import { BadRequestException } from '@nestjs/common';
import { afterCursor, decodeCursor, encodeCursor } from './ticket-cursor.js';

const cursor = { updatedAt: new Date('2026-10-12T08:00:00.123Z'), id: '01a12f11-08cf-775c-83e6-833ccb5d22a2' };

describe('curseur de pagination', () => {
  it('se décode en la même position (milliseconde comprise)', () => {
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('est opaque : du base64url sans caractère à échapper dans une URL', () => {
    expect(encodeCursor(cursor)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['du texte quelconque', 'pas-un-curseur'],
    ['un JSON sans les bons champs', Buffer.from('{"page":2}').toString('base64url')],
    ['un id qui n’est pas un UUID', Buffer.from('{"updatedAt":"2026-10-12T08:00:00Z","id":"1"}').toString('base64url')],
  ])('refuse %s (400)', (_case, value) => {
    expect(() => decodeCursor(value)).toThrow(BadRequestException);
  });

  it('sélectionne les tickets plus anciens, ou de même date avec un id inférieur', () => {
    expect(afterCursor(cursor)).toEqual({
      OR: [{ updatedAt: { lt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, id: { lt: cursor.id } }],
    });
  });
});
