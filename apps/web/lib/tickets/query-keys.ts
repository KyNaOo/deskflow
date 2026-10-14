/** Clés du cache TanStack Query : `["tickets", number]` est le préfixe de tout ce qui concerne un ticket. */
export const ticketKeys = {
  detail: (number: number) => ["tickets", number] as const,
  messages: (number: number) => ["tickets", number, "messages"] as const,
};
