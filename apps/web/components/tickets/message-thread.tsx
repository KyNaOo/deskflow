import { RelativeTime } from "@/components/relative-time";
import type { ThreadMessage } from "@/lib/tickets/message-cache";
import { AttachmentList } from "./attachment-list";
import { cn } from "@/lib/utils";

/**
 * Conversation : les notes internes (agents seulement) sont nettement distinguées des réponses.
 * Un message en cours d'envoi (optimistic update) est affiché atténué.
 */
export function MessageThread({ ticketNumber, messages }: { ticketNumber: number; messages: ThreadMessage[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {messages.map((message) => {
        const fromCustomer = message.author.role === "CUSTOMER";
        return (
          <li
            key={message.id}
            aria-busy={message.pending}
            className={cn(
              "rounded-lg border p-4",
              message.pending && "opacity-60",
              message.isInternalNote && "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
              !message.isInternalNote && !fromCustomer && "bg-muted/50",
            )}
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">{message.author.name}</span>
              <span className="text-muted-foreground">{fromCustomer ? "Client" : "Équipe"}</span>
              {message.isInternalNote && (
                <span className="font-medium text-amber-800 dark:text-amber-300">· Note interne</span>
              )}
              <span className="ml-auto text-muted-foreground">
                {message.pending ? "Envoi…" : <RelativeTime date={message.createdAt} />}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{message.body}</p>
            <AttachmentList ticketNumber={ticketNumber} attachments={message.attachments} pending={message.pending} />
          </li>
        );
      })}
    </ol>
  );
}
