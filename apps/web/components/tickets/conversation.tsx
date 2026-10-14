import type { Message, Ticket } from "@deskflow/shared";
import type { ThreadMessage } from "@/lib/tickets/message-cache";
import { MessageThread } from "./message-thread";
import { ReplyForm } from "./reply-form";

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
      <MessageThread messages={messages} />
      {ticket.status === "CLOSED" ? (
        <p className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
          {closedNotice}
        </p>
      ) : (
        <ReplyForm ticketNumber={ticket.number} author={author} allowInternalNote={allowInternalNote} />
      )}
    </>
  );
}
