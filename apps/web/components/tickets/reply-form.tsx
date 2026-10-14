"use client";

import { ATTACHMENT_MIME_TYPES, createMessageSchema, type CreateMessageInput, type Message } from "@deskflow/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { PaperclipIcon } from "lucide-react";
import { useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useAttachmentUploads } from "@/lib/attachments/use-attachment-uploads";
import { useTypingSignal } from "@/lib/realtime/use-typing";
import { confirmMessage, optimisticMessage, removeMessage, type ThreadMessage } from "@/lib/tickets/message-cache";
import { ticketKeys } from "@/lib/tickets/query-keys";
import { cn } from "@/lib/utils";
import { AttachmentUploads } from "./attachment-uploads";

const MODES = [
  { value: false, label: "Réponse au client" },
  { value: true, label: "Note interne" },
] as const;

interface ReplyFormProps {
  ticketId: string;
  ticketNumber: number;
  /** Utilisateur connecté : auteur du message affiché avant la réponse de l'API */
  author: Message["author"];
  /** Agents uniquement : un client ne peut pas écrire de note interne (refusé par l'API) */
  allowInternalNote?: boolean;
}

export function ReplyForm({ ticketId, ticketNumber, author, allowInternalNote = false }: ReplyFormProps) {
  const queryClient = useQueryClient();
  const signalTyping = useTypingSignal(ticketId);
  // « En train d'écrire… » : signalé pour les agents seulement (refusé par l'API pour un client)
  const isAgent = author.role !== "CUSTOMER";
  const uploads = useAttachmentUploads(ticketNumber);
  const fileInput = useRef<HTMLInputElement>(null);
  const messagesKey = ticketKeys.messages(ticketNumber);
  const form = useForm<CreateMessageInput>({
    resolver: zodResolver(createMessageSchema),
    defaultValues: { body: "", isInternalNote: false },
  });
  const isInternalNote = useWatch({ control: form.control, name: "isInternalNote" });

  function updateMessages(update: (messages: ThreadMessage[]) => ThreadMessage[]) {
    queryClient.setQueryData<ThreadMessage[]>(messagesKey, (messages = []) => update(messages));
  }

  /** Optimistic update : le message s'affiche aussitôt, puis est confirmé ou retiré selon l'API. */
  async function onSubmit(values: CreateMessageInput) {
    const { attachments } = uploads;
    const payload = { ...values, ...(attachments.length > 0 && { attachmentIds: attachments.map(({ id }) => id) }) };
    const pending = optimisticMessage(values, author, attachments);
    // Une relecture en cours écraserait le message ajouté
    await queryClient.cancelQueries({ queryKey: messagesKey });
    updateMessages((messages) => [...messages, pending]);
    form.reset({ body: "", isInternalNote: values.isInternalNote });

    try {
      const saved = await apiFetch<Message>(`/tickets/${ticketNumber}/messages`, { method: "POST", json: payload });
      uploads.reset();
      updateMessages((messages) => confirmMessage(messages, pending.id, saved));
      if (!values.isInternalNote) {
        // Statut et première réponse ont pu changer (aussi poussés par `ticket.updated` si le socket est connecté)
        void queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketNumber), exact: true });
      }
    } catch (error) {
      // Rien ne doit laisser croire que l'envoi a réussi : message retiré, texte rendu pour réessayer
      // (les fichiers joints restent prêts)
      updateMessages((messages) => removeMessage(messages, pending.id));
      form.reset(values);
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
              onChange={(event) => {
                field.onChange(event);
                if (isAgent) signalTyping(isInternalNote ?? false);
              }}
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

      <AttachmentUploads uploads={uploads.uploads} onRemove={uploads.remove} />
      <FieldError errors={[form.formState.errors.root]} />
      <div className="flex items-center justify-between gap-2">
        {/* Le champ fichier natif est masqué : le bouton est plus lisible et reste accessible au clavier */}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ATTACHMENT_MIME_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            uploads.addFiles([...(event.target.files ?? [])]);
            // Permet de choisir à nouveau le même fichier après l'avoir retiré
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
          <PaperclipIcon aria-hidden />
          Joindre un fichier
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting || uploads.isUploading}>
          {isInternalNote ? "Ajouter la note" : allowInternalNote ? "Envoyer la réponse" : "Envoyer"}
        </Button>
      </div>
    </form>
  );
}
