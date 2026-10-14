import { ATTACHMENT_MIME_TYPES, type Attachment, type AttachmentUpload, createAttachmentSchema } from "@deskflow/shared";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

/** Lien stable vers une pièce jointe : l'API contrôle l'accès puis redirige vers le stockage. */
export function attachmentUrl(ticketNumber: number, attachmentId: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}/tickets/${ticketNumber}/attachments/${attachmentId}`;
}

/**
 * Type du fichier. Le navigateur le déduit de l'extension, et pour un journal `.log` il donne selon
 * le système un type vide, `text/x-log` ou `application/octet-stream` : refusé alors que c'est du texte.
 */
export function fileMimeType(file: Pick<File, "name" | "type">): string {
  const isKnownType = (ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type);
  return !isKnownType && /\.(log|txt)$/i.test(file.name) ? "text/plain" : file.type;
}

/** Type et taille vérifiés avant tout envoi, avec les mêmes règles que l'API. */
export function validateFile(file: File): string | null {
  const result = createAttachmentSchema.safeParse({ fileName: file.name, mimeType: fileMimeType(file), size: file.size });
  return result.success ? null : (result.error.issues[0]?.message ?? "Fichier refusé");
}

/**
 * Envoie un fichier : l'API signe le formulaire, puis le navigateur l'envoie directement au
 * stockage. XMLHttpRequest plutôt que fetch : lui seul donne la progression de l'envoi.
 */
export async function uploadAttachment(
  ticketNumber: number,
  file: File,
  onProgress: (percent: number) => void,
): Promise<Attachment> {
  const { attachment, upload } = await apiFetch<AttachmentUpload>(`/tickets/${ticketNumber}/attachments`, {
    method: "POST",
    json: { fileName: file.name, mimeType: fileMimeType(file), size: file.size },
  });

  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) {
    form.append(name, value);
  }
  form.append("file", file);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", upload.url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, "Le stockage a refusé le fichier"));
    xhr.onerror = () => reject(new ApiError(0, "Envoi interrompu, réessayez"));
    xhr.send(form);
  });
  return attachment;
}
