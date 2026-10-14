import { PaperclipIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileUpload } from "@/lib/attachments/use-attachment-uploads";

interface AttachmentUploadsProps {
  uploads: FileUpload[];
  onRemove: (key: number) => void;
}

/** Fichiers joints au message en cours : progression de l'envoi, erreur éventuelle, retrait. */
export function AttachmentUploads({ uploads, onRemove }: AttachmentUploadsProps) {
  if (uploads.length === 0) return null;

  return (
    <ul aria-label="Fichiers joints" className="flex flex-col gap-1.5">
      {uploads.map((upload) => (
        <li key={upload.key} className="flex items-center gap-2 text-sm">
          <PaperclipIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{upload.fileName}</span>
          {upload.error ? (
            <span role="alert" className="text-destructive">
              {upload.error}
            </span>
          ) : upload.attachment ? (
            <span className="text-muted-foreground">Prêt</span>
          ) : (
            <progress
              value={upload.progress}
              max={100}
              aria-label={`Envoi de ${upload.fileName}`}
              className="h-1.5 w-24 accent-foreground"
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="ml-auto"
            aria-label={`Retirer ${upload.fileName}`}
            onClick={() => onRemove(upload.key)}
          >
            <XIcon />
          </Button>
        </li>
      ))}
    </ul>
  );
}
