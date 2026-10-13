"use client";

import { createTicketSchema } from "@deskflow/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { Ticket } from "@/lib/api/types";

// Le client est l'utilisateur connecté et la priorité est réglée par l'équipe : sujet et description
const formSchema = createTicketSchema.pick({ subject: true, message: true });
type NewRequestValues = z.infer<typeof formSchema>;

export function NewRequestForm({ tenant }: { tenant: string }) {
  const router = useRouter();
  const form = useForm<NewRequestValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { subject: "", message: "" },
  });

  async function onSubmit(values: NewRequestValues) {
    try {
      const ticket = await apiFetch<Ticket>("/tickets", { method: "POST", json: values });
      router.push(`/portal/${tenant}/tickets/${ticket.number}`);
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="rounded-lg border bg-background p-6">
      <FieldGroup>
        <TextField control={form.control} name="subject" label="Sujet" />
        <Controller
          control={form.control}
          name="message"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="message">Décrivez votre problème</FieldLabel>
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
        <FieldError errors={[form.formState.errors.root]} />
        <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Envoi…" : "Envoyer la demande"}
        </Button>
      </FieldGroup>
    </form>
  );
}
