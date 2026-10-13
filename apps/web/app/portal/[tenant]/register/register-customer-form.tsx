"use client";

import { registerCustomerSchema, type RegisterCustomerInput } from "@deskflow/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { apiFetch } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";

export function RegisterCustomerForm({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const form = useForm<RegisterCustomerInput>({
    resolver: zodResolver(registerCustomerSchema),
    defaultValues: { tenantSlug, name: "", email: "", password: "" },
  });

  async function onSubmit(values: RegisterCustomerInput) {
    try {
      await apiFetch("/auth/register-customer", { method: "POST", json: values });
      // La session a changé : les layouts déjà affichés (en-tête…) doivent être relus
      router.push(`/portal/${tenantSlug}/tickets`);
      router.refresh();
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <TextField control={form.control} name="name" label="Votre nom" autoComplete="name" />
        <TextField control={form.control} name="email" label="E-mail" type="email" autoComplete="email" />
        <TextField
          control={form.control}
          name="password"
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          description="8 caractères minimum"
        />
        <FieldError errors={[form.formState.errors.root]} />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Création…" : "Créer mon compte"}
        </Button>
      </FieldGroup>
    </form>
  );
}
