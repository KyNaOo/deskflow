"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { apiFetch } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { acceptInvitationSchema, type AcceptInvitationValues } from "@/lib/auth/schemas";

export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const form = useForm<AcceptInvitationValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { name: "", password: "" },
  });

  async function onSubmit(values: AcceptInvitationValues) {
    try {
      await apiFetch("/auth/accept-invitation", { method: "POST", json: { ...values, token } });
      // L'accueil redirige vers l'espace de l'organisation de l'invitation
      router.push("/");
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <TextField control={form.control} name="name" label="Votre nom" autoComplete="name" />
        <TextField control={form.control} name="password" label="Mot de passe" type="password" autoComplete="new-password" description="8 caractères minimum" />
        <FieldError errors={[form.formState.errors.root]} />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Création du compte…" : "Rejoindre"}
        </Button>
      </FieldGroup>
    </form>
  );
}
