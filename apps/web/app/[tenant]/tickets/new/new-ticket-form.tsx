"use client";

import { createTicketSchema, TICKET_PRIORITIES } from "@deskflow/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { Member, Ticket } from "@/lib/api/types";
import { PRIORITY_LABELS } from "@/lib/tickets/labels";

// Même schéma que l'API ; le client y est facultatif (un client ouvre ses propres tickets),
// mais obligatoire quand c'est un agent qui ouvre le ticket
const formSchema = createTicketSchema.extend({ customerId: z.uuid("Choisissez un client") });
type NewTicketValues = z.infer<typeof formSchema>;

interface NewTicketFormProps {
  tenant: string;
  customers: Pick<Member, "id" | "name" | "email">[];
}

export function NewTicketForm({ tenant, customers }: NewTicketFormProps) {
  const router = useRouter();
  const form = useForm<NewTicketValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { customerId: "", subject: "", message: "", priority: "MEDIUM" },
  });

  async function onSubmit(values: NewTicketValues) {
    try {
      const ticket = await apiFetch<Ticket>("/tickets", { method: "POST", json: values });
      router.push(`/${tenant}/tickets/${ticket.number}`);
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={form.control}
          name="customerId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="customerId">Client</FieldLabel>
              <NativeSelect
                {...field}
                id="customerId"
                className="w-full"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? "customerId-error" : undefined}
              >
                <NativeSelectOption value="">Choisir un client…</NativeSelectOption>
                {customers.map((customer) => (
                  <NativeSelectOption key={customer.id} value={customer.id}>
                    {customer.name} ({customer.email})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {fieldState.invalid && <FieldError id="customerId-error" errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <TextField control={form.control} name="subject" label="Sujet" />

        <Controller
          control={form.control}
          name="message"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="message">Description</FieldLabel>
              <Textarea
                {...field}
                id="message"
                rows={6}
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? "message-error" : undefined}
              />
              {fieldState.invalid && <FieldError id="message-error" errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="priority"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="priority">Priorité</FieldLabel>
              <NativeSelect {...field} id="priority">
                {TICKET_PRIORITIES.map((priority) => (
                  <NativeSelectOption key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        />

        <FieldError errors={[form.formState.errors.root]} />
        <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Création…" : "Créer le ticket"}
        </Button>
      </FieldGroup>
    </form>
  );
}
