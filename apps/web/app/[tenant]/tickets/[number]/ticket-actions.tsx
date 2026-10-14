"use client";

import { TICKET_PRIORITIES, type UpdateTicketInput } from "@deskflow/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { apiFetch } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { Member, Ticket } from "@/lib/api/types";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/tickets/labels";
import { ticketKeys } from "@/lib/tickets/query-keys";
import { statusOptions } from "@/lib/tickets/status-options";

interface TicketActionsProps {
  ticket: Ticket;
  agents: Pick<Member, "id" | "name">[];
}

/** Statut, priorité et assignation : chaque changement est enregistré aussitôt, puis reporté dans le cache. */
export function TicketActions({ ticket, agents }: TicketActionsProps) {
  const queryClient = useQueryClient();
  const ticketKey = ticketKeys.detail(ticket.number);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function update(changes: UpdateTicketInput) {
    setError(undefined);
    setBusy(true);
    try {
      const updated = await apiFetch<Ticket>(`/tickets/${ticket.number}`, { method: "PATCH", json: changes });
      queryClient.setQueryData(ticketKey, updated);
    } catch (caught) {
      // Ex. un autre agent a changé le statut entre-temps (409) : on affiche et on relit l'état réel
      setError(errorMessage(caught));
      await queryClient.invalidateQueries({ queryKey: ticketKey, exact: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={busy}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-status">Statut</Label>
        <NativeSelect
          id="ticket-status"
          className="w-full"
          value={ticket.status}
          disabled={busy || ticket.status === "CLOSED"}
          onChange={(event) => update({ status: event.target.value as Ticket["status"] })}
        >
          {/* Seules les transitions autorisées par la machine à états sont proposées */}
          {statusOptions(ticket.status).map((status) => (
            <NativeSelectOption key={status} value={status}>
              {STATUS_LABELS[status]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-priority">Priorité</Label>
        <NativeSelect
          id="ticket-priority"
          className="w-full"
          value={ticket.priority}
          disabled={busy}
          onChange={(event) => update({ priority: event.target.value as Ticket["priority"] })}
        >
          {TICKET_PRIORITIES.map((priority) => (
            <NativeSelectOption key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-assignee">Assigné à</Label>
        <NativeSelect
          id="ticket-assignee"
          className="w-full"
          value={ticket.assignee?.id ?? ""}
          disabled={busy}
          onChange={(event) => update({ assigneeId: event.target.value || null })}
        >
          <NativeSelectOption value="">Non assigné</NativeSelectOption>
          {agents.map((agent) => (
            <NativeSelectOption key={agent.id} value={agent.id}>
              {agent.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <FieldError>{error}</FieldError>
    </div>
  );
}
