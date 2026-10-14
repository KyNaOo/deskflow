import { attachmentKey, contentDisposition } from './storage-keys.js';

describe('attachmentKey', () => {
  it('range la pièce jointe sous son tenant et son ticket, avec un identifiant aléatoire', () => {
    const key = attachmentKey('tenant-1', 'ticket-1');

    expect(key).toMatch(/^tenants\/tenant-1\/tickets\/ticket-1\/[0-9a-f-]{36}$/);
    expect(attachmentKey('tenant-1', 'ticket-1')).not.toBe(key);
  });
});

describe('contentDisposition', () => {
  it('ouvre les images et les PDF dans le navigateur', () => {
    expect(contentDisposition('capture.png', 'image/png')).toMatch(/^inline;/);
    expect(contentDisposition('facture.pdf', 'application/pdf')).toMatch(/^inline;/);
  });

  it('télécharge les fichiers texte', () => {
    expect(contentDisposition('erreurs.log', 'text/plain')).toMatch(/^attachment;/);
  });

  it('encode les noms accentués et neutralise les guillemets', () => {
    expect(contentDisposition('relevé "mars".pdf', 'application/pdf')).toBe(
      `inline; filename="releve _mars_.pdf"; filename*=UTF-8''relev%C3%A9%20%22mars%22.pdf`,
    );
  });
});
