import { describe, expect, it } from 'vitest';
import { createAttachmentSchema, MAX_ATTACHMENT_SIZE } from './attachments.js';

const valid = { fileName: 'capture.png', mimeType: 'image/png', size: 1024 };

describe('createAttachmentSchema', () => {
  it('accepte une image, un PDF ou un fichier texte', () => {
    for (const mimeType of ['image/png', 'image/jpeg', 'application/pdf', 'text/plain']) {
      expect(createAttachmentSchema.safeParse({ ...valid, mimeType }).success).toBe(true);
    }
  });

  it('refuse les types qui peuvent exécuter du script ou inconnus', () => {
    for (const mimeType of ['image/svg+xml', 'text/html', 'application/x-msdownload', '']) {
      expect(createAttachmentSchema.safeParse({ ...valid, mimeType }).success).toBe(false);
    }
  });

  it('accepte jusqu’à la taille maximale, pas au-delà', () => {
    expect(createAttachmentSchema.safeParse({ ...valid, size: MAX_ATTACHMENT_SIZE }).success).toBe(true);
    const tooBig = createAttachmentSchema.safeParse({ ...valid, size: MAX_ATTACHMENT_SIZE + 1 });
    expect(tooBig.error?.issues[0]?.message).toBe('Fichier trop volumineux (10 Mo maximum)');
  });

  it('refuse un fichier vide ou sans nom', () => {
    expect(createAttachmentSchema.safeParse({ ...valid, size: 0 }).success).toBe(false);
    expect(createAttachmentSchema.safeParse({ ...valid, fileName: '  ' }).success).toBe(false);
  });
});
