import type { Message } from "@deskflow/shared";
import { describe, expect, it } from "vitest";
import { addMessage, confirmMessage, optimisticMessage, removeMessage } from "./message-cache";

const author: Message["author"] = { id: "agent-1", name: "Alice", role: "AGENT" };

function message(id: string, body = `Message ${id}`): Message {
  return { id, body, isInternalNote: false, createdAt: "2026-10-14T10:00:00.000Z", author, attachments: [] };
}

describe("optimisticMessage", () => {
  it("crée un message en attente, avec un identifiant temporaire unique", () => {
    const first = optimisticMessage({ body: "Bonjour" }, author);
    const second = optimisticMessage({ body: "Bonjour", isInternalNote: true }, author);

    expect(first).toMatchObject({ body: "Bonjour", isInternalNote: false, author, attachments: [], pending: true });
    expect(second.isInternalNote).toBe(true);
    expect(first.id).not.toBe(second.id);
  });
});

describe("addMessage", () => {
  it("ajoute le message en fin de conversation", () => {
    expect(addMessage([message("a")], message("b")).map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("ignore un message déjà présent (événement de son propre message)", () => {
    const messages = [message("a")];

    expect(addMessage(messages, message("a"))).toBe(messages);
  });
});

describe("confirmMessage", () => {
  it("remplace le message optimiste à sa place, sans l'état « en attente »", () => {
    const pending = optimisticMessage({ body: "Ma réponse" }, author);
    const saved = message("saved", "Ma réponse");

    const result = confirmMessage([message("a"), pending, message("b")], pending.id, saved);

    expect(result).toEqual([message("a"), saved, message("b")]);
  });

  it("retire le message optimiste si l'événement WebSocket l'a déjà ajouté", () => {
    const pending = optimisticMessage({ body: "Ma réponse" }, author);
    const saved = message("saved", "Ma réponse");
    const afterSocket = addMessage([message("a"), pending], saved);

    expect(confirmMessage(afterSocket, pending.id, saved)).toEqual([message("a"), saved]);
  });
});

describe("removeMessage", () => {
  it("retire le message optimiste d'un envoi échoué", () => {
    const pending = optimisticMessage({ body: "Perdu" }, author);

    expect(removeMessage([message("a"), pending], pending.id)).toEqual([message("a")]);
  });
});
