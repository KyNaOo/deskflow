"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { apiFetch } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { loginSchema, type LoginValues } from "@/lib/auth/schemas";

export function LoginForm() {
  const router = useRouter();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { tenantSlug: "", email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    try {
      await apiFetch("/auth/login", { method: "POST", json: values });
      router.push(`/${values.tenantSlug}`);
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <TextField control={form.control} name="tenantSlug" label="Organisation" autoComplete="organization" description="Identifiant de votre organisation, ex. acme" />
        <TextField control={form.control} name="email" label="E-mail" type="email" autoComplete="email" />
        <TextField control={form.control} name="password" label="Mot de passe" type="password" autoComplete="current-password" />
        <FieldError errors={[form.formState.errors.root]} />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Connexion…" : "Se connecter"}
        </Button>
      </FieldGroup>
    </form>
  );
}
