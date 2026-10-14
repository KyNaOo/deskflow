import type { Attachment } from "@deskflow/shared";
import { PaperclipIcon } from "lucide-react";
import { attachmentUrl } from "@/lib/attachments/upload";
import { formatFileSize } from "@/lib/format-file-size";

interface AttachmentListProps {
  ticketNumber: number;
  attachments: Attachment[];
  /** Message pas encore confirmé par l'API : pièces jointes pas encore téléchargeables */
  pending?: boolean;
}

/** Pièces jointes d'un message : chaque lien passe par l'API, qui contrôle l'accès. */
export function AttachmentList({ ticketNumber, attachments, pending = false }: AttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <ul aria-label="Pièces jointes" className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <li key={attachment.id} className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-sm">
          <PaperclipIcon aria-hidden className="size-3.5 text-muted-foreground" />
          {pending ? (
            <span>{attachment.fileName}</span>
          ) : (
            <a href={attachmentUrl(ticketNumber, attachment.id)} target="_blank" rel="noopener" className="hover:underline">
              {attachment.fileName}
            </a>
          )}
          <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span>
        </li>
      ))}
    </ul>
  );
}
