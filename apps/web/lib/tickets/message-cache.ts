import type { Attachment, Message } from "@deskflow/shared";

/** Message affiché dans la conversation : `pending` tant que l'API n'a pas confirmé l'envoi. */
export type ThreadMessage = Message & { pending?: boolean };

let optimisticCount = 0;

/** Message affiché dès l'envoi, avant la réponse de l'API (optimistic update). */
export function optimisticMessage(
  input: { body: string; isInternalNote?: boolean },
  author: Message["author"],
  attachments: Attachment[] = [],
): ThreadMessage {
  optimisticCount += 1;
  return {
    id: `optimistic-${optimisticCount}`,
    body: input.body,
    isInternalNote: input.isInternalNote ?? false,
    createdAt: new Date().toISOString(),
    author,
    attachments,
    pending: true,
  };
}

/**
 * Ajoute un message reçu (WebSocket), sauf s'il est déjà là : l'auteur reçoit aussi l'événement
 * de son propre message, avant ou après la réponse de l'API.
 */
export function addMessage(messages: ThreadMessage[], message: Message): ThreadMessage[] {
  return messages.some(({ id }) => id === message.id) ? messages : [...messages, message];
}

/** Remplace le message optimiste par celui enregistré (ou le retire, si l'événement est arrivé avant). */
export function confirmMessage(messages: ThreadMessage[], optimisticId: string, saved: Message): ThreadMessage[] {
  if (messages.some(({ id }) => id === saved.id)) {
    return removeMessage(messages, optimisticId);
  }
  return messages.map((message) => (message.id === optimisticId ? saved : message));
}

export function removeMessage(messages: ThreadMessage[], id: string): ThreadMessage[] {
  return messages.filter((message) => message.id !== id);
}
