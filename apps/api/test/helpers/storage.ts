import type { AttachmentUpload } from '@deskflow/shared';

/** Envoi direct au stockage, comme le navigateur : champs signés, puis le fichier. */
export function uploadToStorage(
  { upload }: AttachmentUpload,
  content: string,
  fieldOverrides: Record<string, string> = {},
) {
  const form = new FormData();
  for (const [name, value] of Object.entries({ ...upload.fields, ...fieldOverrides })) {
    form.append(name, value);
  }
  form.append('file', new Blob([content]));
  return fetch(upload.url, { method: 'POST', body: form });
}
