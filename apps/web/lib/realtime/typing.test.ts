import type { AgentTypingEvent } from "@deskflow/shared";
import { describe, expect, it } from "vitest";
import {
  shouldSignalTyping,
  startTyping,
  stopTyping,
  TYPING_THROTTLE_MS,
  TYPING_TIMEOUT_MS,
  typingLabel,
  withoutExpired,
} from "./typing";

function event(id: string, name: string, isInternalNote = false): AgentTypingEvent {
  return { ticketId: "ticket-1", agent: { id, name }, isInternalNote };
}

describe("startTyping", () => {
  it("ajoute l'agent jusqu'à l'expiration du délai", () => {
    expect(startTyping([], event("a", "Alice"), 1000)).toEqual([
      { id: "a", name: "Alice", isInternalNote: false, expiresAt: 1000 + TYPING_TIMEOUT_MS },
    ]);
  });

  it("prolonge un agent déjà présent sans le dupliquer", () => {
    const agents = startTyping([], event("a", "Alice"), 1000);

    expect(startTyping(agents, event("a", "Alice", true), 3000)).toEqual([
      { id: "a", name: "Alice", isInternalNote: true, expiresAt: 3000 + TYPING_TIMEOUT_MS },
    ]);
  });
});

describe("withoutExpired", () => {
  it("masque l'indicateur après le délai sans nouveau signal", () => {
    const agents = startTyping(startTyping([], event("a", "Alice"), 0), event("b", "Bob"), 3000);

    expect(withoutExpired(agents, TYPING_TIMEOUT_MS - 1).map(({ id }) => id)).toEqual(["a", "b"]);
    expect(withoutExpired(agents, TYPING_TIMEOUT_MS).map(({ id }) => id)).toEqual(["b"]);
    expect(withoutExpired(agents, 3000 + TYPING_TIMEOUT_MS)).toEqual([]);
  });
});

describe("stopTyping", () => {
  it("retire l'auteur d'un message reçu", () => {
    const agents = startTyping([], event("a", "Alice"), 0);

    expect(stopTyping(agents, "a")).toEqual([]);
  });

  it("ne change rien pour un message d'un autre auteur", () => {
    const agents = startTyping([], event("a", "Alice"), 0);

    expect(stopTyping(agents, "client")).toBe(agents);
  });
});

describe("typingLabel", () => {
  it("rien quand personne n'écrit", () => {
    expect(typingLabel([])).toBeNull();
  });

  it("nomme l'agent, et précise une note interne", () => {
    expect(typingLabel(startTyping([], event("a", "Alice"), 0))).toBe("Alice est en train d’écrire…");
    expect(typingLabel(startTyping([], event("a", "Alice", true), 0))).toBe("Alice rédige une note interne…");
  });

  it("regroupe plusieurs agents", () => {
    let agents = startTyping([], event("a", "Alice"), 0);
    agents = startTyping(agents, event("b", "Bob"), 0);
    expect(typingLabel(agents)).toBe("Alice et Bob sont en train d’écrire…");

    agents = startTyping(agents, event("c", "Chloé"), 0);
    expect(typingLabel(agents)).toBe("Alice, Bob et Chloé sont en train d’écrire…");
  });
});

describe("shouldSignalTyping", () => {
  it("signale la première frappe", () => {
    expect(shouldSignalTyping(null, false, 0)).toBe(true);
  });

  it("limite les signaux pendant la saisie", () => {
    const last = { at: 1000, isInternalNote: false };

    expect(shouldSignalTyping(last, false, 1000 + TYPING_THROTTLE_MS - 1)).toBe(false);
    expect(shouldSignalTyping(last, false, 1000 + TYPING_THROTTLE_MS)).toBe(true);
  });

  it("signale aussitôt le passage à une note interne", () => {
    expect(shouldSignalTyping({ at: 1000, isInternalNote: false }, true, 1001)).toBe(true);
  });
});
