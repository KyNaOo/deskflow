import { type Attachment, MAX_ATTACHMENTS_PER_MESSAGE } from "@deskflow/shared";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { uploadAttachment, validateFile } from "./upload";

export interface FileUpload {
  key: number;
  fileName: string;
  progress: number;
  /** Renseignée une fois le fichier arrivé dans le stockage */
  attachment?: Attachment;
  error?: string;
}

let nextKey = 0;

/** Fichiers joints au message en cours de rédaction : envoyés dès leur sélection. */
export function useAttachmentUploads(ticketNumber: number) {
  const [uploads, setUploads] = useState<FileUpload[]>([]);

  function update(key: number, changes: Partial<FileUpload>) {
    setUploads((current) => current.map((upload) => (upload.key === key ? { ...upload, ...changes } : upload)));
  }

  function addFiles(files: File[]) {
    const room = MAX_ATTACHMENTS_PER_MESSAGE - uploads.length;
    for (const [index, file] of files.entries()) {
      nextKey += 1;
      const key = nextKey;
      const error =
        index >= room ? `${MAX_ATTACHMENTS_PER_MESSAGE} pièces jointes maximum par message` : validateFile(file);
      setUploads((current) => [...current, { key, fileName: file.name, progress: 0, ...(error && { error }) }]);
      if (error) continue;

      uploadAttachment(ticketNumber, file, (progress) => update(key, { progress })).then(
        (attachment) => update(key, { attachment, progress: 100 }),
        (caught: unknown) => update(key, { error: errorMessage(caught) }),
      );
    }
  }

  return {
    uploads,
    addFiles,
    remove: (key: number) => setUploads((current) => current.filter((upload) => upload.key !== key)),
    reset: () => setUploads([]),
    /** Pièces jointes prêtes à être rattachées au message */
    attachments: uploads.flatMap(({ attachment, error }) => (attachment && !error ? [attachment] : [])),
    isUploading: uploads.some(({ attachment, error }) => !attachment && !error),
  };
}
