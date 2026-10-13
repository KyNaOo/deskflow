"use client";

import { loginSchema, type LoginInput, type Role } from "@deskflow/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { apiFetch } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { homePath } from "@/lib/auth/paths";

interface LoginFormProps {
  /** Organisation déjà connue (portail client) : le champ n'est alors pas affiché */
  tenantSlug?: string;
}

export function LoginForm({ tenantSlug }: LoginFormProps) {
  const router = useRouter();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { tenantSlug: tenantSlug ?? "", email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    try {
      const { user } = await apiFetch<{ user: { role: Role } }>("/auth/login", { method: "POST", json: values });
      // Un client va sur le portail, un agent ou un admin sur son espace, d'où qu'il se connecte
      router.push(homePath(user.role, values.tenantSlug));
      // La session a changé : les layouts déjà affichés (en-tête…) doivent être relus
      router.refresh();
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {!tenantSlug && (
          <TextField control={form.control} name="tenantSlug" label="Organisation" autoComplete="organization" description="Identifiant de votre organisation, ex. acme" />
        )}
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
