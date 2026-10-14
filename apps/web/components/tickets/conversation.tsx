import type { Message, Ticket } from "@deskflow/shared";
import type { ThreadMessage } from "@/lib/tickets/message-cache";
import { MessageThread } from "./message-thread";
import { ReplyForm } from "./reply-form";
import { TypingIndicator } from "./typing-indicator";

interface ConversationProps {
  ticket: Ticket;
  messages: ThreadMessage[];
  author: Message["author"];
  allowInternalNote?: boolean;
  /** Texte affiché à la place du formulaire une fois le ticket clos */
  closedNotice: string;
}

/** Fil de messages et formulaire de réponse, communs à l'espace agents et au portail. */
export function Conversation({ ticket, messages, author, allowInternalNote, closedNotice }: ConversationProps) {
  return (
    <>
      <MessageThread ticketNumber={ticket.number} messages={messages} />
      {ticket.status === "CLOSED" ? (
        <p className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
          {closedNotice}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <TypingIndicator ticketId={ticket.id} currentUserId={author.id} />
          <ReplyForm
            ticketId={ticket.id}
            ticketNumber={ticket.number}
            author={author}
            allowInternalNote={allowInternalNote}
          />
        </div>
      )}
    </>
  );
}
