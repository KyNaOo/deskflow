"use client";

import { TICKET_PRIORITIES, TICKET_STATUSES } from "@deskflow/shared";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Member } from "@/lib/api/types";
import { hasActiveFilters, toSearchParams, withFilter, type TicketFilters } from "@/lib/tickets/filters";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/tickets/labels";

const SEARCH_DEBOUNCE_MS = 300;

interface TicketFiltersFormProps {
  filters: TicketFilters;
  agents: Pick<Member, "id" | "name">[];
}

/**
 * Seul morceau interactif de la page : il ne charge rien lui-même, il réécrit l'URL et le
 * Server Component relit les tickets avec les nouveaux filtres.
 */
export function TicketFiltersForm({ filters, agents }: TicketFiltersFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q ?? "");

  function apply(next: TicketFilters) {
    // replace : changer un filtre n'ajoute pas une entrée par frappe dans l'historique
    startTransition(() => router.replace(`${pathname}?${toSearchParams(next)}`));
  }

  // La recherche part après une courte pause dans la frappe, pas à chaque touche
  useEffect(() => {
    if (search.trim() === (filters.q ?? "")) {
      return;
    }
    const timeout = setTimeout(() => apply(withFilter(filters, "q", search.trim())), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la saisie déclenche la recherche
  }, [search]);

  return (
    <search aria-label="Filtrer les tickets" aria-busy={isPending} className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-60 flex-1 flex-col gap-1.5">
        <Label htmlFor="ticket-search">Recherche</Label>
        <Input
          id="ticket-search"
          type="search"
          placeholder="Sujet ou numéro (#42)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <FilterSelect
        id="ticket-status"
        label="Statut"
        value={filters.status}
        onChange={(value) => apply(withFilter(filters, "status", value))}
        options={TICKET_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
      />
      <FilterSelect
        id="ticket-priority"
        label="Priorité"
        value={filters.priority}
        onChange={(value) => apply(withFilter(filters, "priority", value))}
        options={TICKET_PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority] }))}
      />
      <FilterSelect
        id="ticket-assignee"
        label="Assigné à"
        value={filters.assignee}
        onChange={(value) => apply(withFilter(filters, "assignee", value))}
        options={[
          { value: "me", label: "Moi" },
          { value: "none", label: "Non assigné" },
          ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
        ]}
      />

      {hasActiveFilters(filters) && (
        <Button
          variant="link"
          onClick={() => {
            setSearch("");
            apply({});
          }}
        >
          Réinitialiser
        </Button>
      )}
    </search>
  );
}

interface FilterSelectProps {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function FilterSelect({ id, label, value, onChange, options }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <NativeSelectOption value="">Tous</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
