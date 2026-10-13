"use client";

import { createMessageSchema, type CreateMessageInput } from "@deskflow/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const MODES = [
  { value: false, label: "Réponse au client" },
  { value: true, label: "Note interne" },
] as const;

interface ReplyFormProps {
  ticketNumber: number;
  /** Agents uniquement : un client ne peut pas écrire de note interne (refusé par l'API) */
  allowInternalNote?: boolean;
}

export function ReplyForm({ ticketNumber, allowInternalNote = false }: ReplyFormProps) {
  const router = useRouter();
  const form = useForm<CreateMessageInput>({
    resolver: zodResolver(createMessageSchema),
    defaultValues: { body: "", isInternalNote: false },
  });
  const isInternalNote = useWatch({ control: form.control, name: "isInternalNote" });

  async function onSubmit(values: CreateMessageInput) {
    try {
      await apiFetch(`/tickets/${ticketNumber}/messages`, { method: "POST", json: values });
      form.reset({ body: "", isInternalNote: values.isInternalNote });
      // Relit le Server Component : nouveau message, statut et première réponse à jour
      router.refresh();
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      {allowInternalNote && (
        <Controller
        control={form.control}
        name="isInternalNote"
        render={({ field }) => (
          <fieldset className="flex gap-2">
            <legend className="sr-only">Type de message</legend>
            {MODES.map((mode) => (
              <label
                key={mode.label}
                className={cn(
                  "cursor-pointer rounded-md border px-3 py-1 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  field.value === mode.value && "border-foreground font-medium",
                )}
              >
                <input
                  type="radio"
                  name={field.name}
                  className="sr-only"
                  checked={field.value === mode.value}
                  onChange={() => field.onChange(mode.value)}
                />
                {mode.label}
              </label>
            ))}
          </fieldset>
        )}
        />
      )}

      <Controller
        control={form.control}
        name="body"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="reply-body" className="sr-only">
              Message
            </FieldLabel>
            <Textarea
              {...field}
              id="reply-body"
              rows={4}
              placeholder={isInternalNote ? "Visible uniquement par l’équipe" : allowInternalNote ? "Votre réponse au client" : "Votre message"}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.invalid ? "reply-body-error" : undefined}
              className={cn(isInternalNote && "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950")}
            />
            {fieldState.invalid && <FieldError id="reply-body-error" errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <FieldError errors={[form.formState.errors.root]} />
      <Button type="submit" className="self-end" disabled={form.formState.isSubmitting}>
        {isInternalNote ? "Ajouter la note" : allowInternalNote ? "Envoyer la réponse" : "Envoyer"}
      </Button>
    </form>
  );
}
