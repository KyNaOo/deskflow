import type { AgentTypingEvent } from "@deskflow/shared";

/** Un agent est considéré comme en train d'écrire jusqu'à 5 s après son dernier signal. */
export const TYPING_TIMEOUT_MS = 5000;
/** Pendant la saisie, un signal toutes les 2 s au plus (bien moins que le délai d'expiration). */
export const TYPING_THROTTLE_MS = 2000;

export interface TypingAgent {
  id: string;
  name: string;
  isInternalNote: boolean;
  expiresAt: number;
}

/** Enregistre (ou prolonge) la saisie d'un agent. */
export function startTyping(agents: TypingAgent[], { agent, isInternalNote }: AgentTypingEvent, now: number): TypingAgent[] {
  const others = agents.filter(({ id }) => id !== agent.id);
  return [...others, { ...agent, isInternalNote, expiresAt: now + TYPING_TIMEOUT_MS }];
}

/** L'agent a envoyé son message : il n'écrit plus. */
export function stopTyping(agents: TypingAgent[], agentId: string): TypingAgent[] {
  return agents.some(({ id }) => id === agentId) ? agents.filter(({ id }) => id !== agentId) : agents;
}

/** Retire les agents sans nouveau signal depuis TYPING_TIMEOUT_MS. */
export function withoutExpired(agents: TypingAgent[], now: number): TypingAgent[] {
  return agents.filter(({ expiresAt }) => expiresAt > now);
}

/** « Alice est en train d'écrire… », « Alice et Bob sont en train d'écrire… » */
export function typingLabel(agents: TypingAgent[]): string | null {
  const [first] = agents;
  if (!first) return null;
  if (agents.length === 1) {
    return first.isInternalNote ? `${first.name} rédige une note interne…` : `${first.name} est en train d’écrire…`;
  }
  const names = agents.map(({ name }) => name);
  return `${names.slice(0, -1).join(", ")} et ${names.at(-1)} sont en train d’écrire…`;
}

/**
 * Faut-il signaler la saisie ? Oui au premier caractère, puis au plus toutes les TYPING_THROTTLE_MS,
 * et tout de suite si l'agent passe d'une réponse à une note interne (ou l'inverse).
 */
export function shouldSignalTyping(
  lastSignal: { at: number; isInternalNote: boolean } | null,
  isInternalNote: boolean,
  now: number,
): boolean {
  return !lastSignal || lastSignal.isInternalNote !== isInternalNote || now - lastSignal.at >= TYPING_THROTTLE_MS;
}
