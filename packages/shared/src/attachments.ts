import { z } from 'zod';
import { requiredText } from './fields.js';

/**
 * Types acceptés : captures d'écran, PDF et texte (logs). Pas de SVG ni d'HTML : affichés par
 * le navigateur, ils peuvent exécuter du script.
 */
export const ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
] as const;

export type AttachmentMimeType = (typeof ATTACHMENT_MIME_TYPES)[number];

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

/** Fichier que le navigateur s'apprête à envoyer (`POST /tickets/:number/attachments`) */
export const createAttachmentSchema = z.strictObject({
  fileName: requiredText(200),
  mimeType: z.enum(ATTACHMENT_MIME_TYPES, 'Type de fichier non autorisé (images, PDF ou texte)'),
  size: z
    .number()
    .int()
    .min(1, 'Fichier vide')
    .max(MAX_ATTACHMENT_SIZE, `Fichier trop volumineux (${MAX_ATTACHMENT_SIZE / 1024 / 1024} Mo maximum)`),
});

export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;

/** Pièce jointe d'un message, telle que renvoyée par l'API */
export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

/**
 * Réponse de `POST /tickets/:number/attachments` : la pièce jointe et le formulaire présigné
 * à envoyer directement au stockage (POST multipart : `fields`, puis le champ `file`).
 */
export interface AttachmentUpload {
  attachment: Attachment;
  upload: { url: string; fields: Record<string, string> };
}
