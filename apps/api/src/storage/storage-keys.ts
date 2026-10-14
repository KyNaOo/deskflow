import { randomUUID } from 'node:crypto';

/**
 * Clé d'une pièce jointe dans le bucket. Le nom du fichier n'y figure pas : choisi par
 * l'utilisateur, il pourrait contenir `../` ou des caractères spéciaux. Il est stocké en base.
 */
export function attachmentKey(tenantId: string, ticketId: string): string {
  return `tenants/${tenantId}/tickets/${ticketId}/${randomUUID()}`;
}

const INLINE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']);

/**
 * En-tête Content-Disposition du téléchargement : images et PDF s'ouvrent dans le navigateur,
 * le reste est téléchargé. Le nom d'origine est encodé (RFC 6266 / 5987), avec un équivalent
 * ASCII pour les anciens navigateurs.
 */
export function contentDisposition(fileName: string, mimeType: string): string {
  const disposition = INLINE_MIME_TYPES.has(mimeType) ? 'inline' : 'attachment';
  const asciiName = fileName.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '_') || 'fichier';
  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
