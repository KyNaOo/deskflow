import { listTicketsQuerySchema, type ListTicketsQuery } from "@deskflow/shared";

/** Filtres de la liste des tickets, tels qu'ils vivent dans l'URL (partageable, rechargeable). */
export type TicketFilters = Partial<Pick<ListTicketsQuery, "status" | "priority" | "assignee" | "q" | "cursor">>;

const FILTER_KEYS = ["status", "priority", "assignee", "q", "cursor"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * searchParams de la page → filtres, avec les règles de validation de l'API (@deskflow/shared).
 * Une valeur invalide (URL modifiée à la main) est ignorée plutôt que de casser la page.
 */
export function parseFilters(searchParams: SearchParams): TicketFilters {
  const filters: TicketFilters = {};
  for (const key of FILTER_KEYS) {
    const raw = searchParams[key];
    const result = listTicketsQuerySchema.shape[key].safeParse(Array.isArray(raw) ? raw[0] : raw);
    if (result.success && result.data) {
      Object.assign(filters, { [key]: result.data });
    }
  }
  return filters;
}

/** Filtres → paramètres d'URL, sans les filtres vides. */
export function toSearchParams(filters: TicketFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  }
  return params;
}

/** Change un filtre ; la liste repart de la première page (le curseur ne vaut plus rien). */
export function withFilter(filters: TicketFilters, key: Exclude<keyof TicketFilters, "cursor">, value: string) {
  return { ...filters, cursor: undefined, [key]: value || undefined } as TicketFilters;
}

export function hasActiveFilters(filters: TicketFilters): boolean {
  return Boolean(filters.status || filters.priority || filters.assignee || filters.q);
}
