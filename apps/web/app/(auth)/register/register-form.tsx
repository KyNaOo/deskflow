"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { apiFetch } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { registerSchema, type RegisterValues } from "@/lib/auth/schemas";

export function RegisterForm() {
  const router = useRouter();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { organizationName: "", slug: "", name: "", email: "", password: "" },
  });

  async function onSubmit(values: RegisterValues) {
    try {
      await apiFetch("/auth/register-tenant", { method: "POST", json: values });
      router.push(`/${values.slug}`);
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <TextField control={form.control} name="organizationName" label="Nom de l’organisation" autoComplete="organization" />
        <TextField control={form.control} name="slug" label="Identifiant" description="Utilisé dans vos adresses : deskflow/acme" />
        <TextField control={form.control} name="name" label="Votre nom" autoComplete="name" />
        <TextField control={form.control} name="email" label="E-mail" type="email" autoComplete="email" />
        <TextField control={form.control} name="password" label="Mot de passe" type="password" autoComplete="new-password" description="8 caractères minimum" />
        <FieldError errors={[form.formState.errors.root]} />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Création…" : "Créer l’espace"}
        </Button>
      </FieldGroup>
    </form>
  );
}
