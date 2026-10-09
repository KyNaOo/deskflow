import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { serverFetch } from "@/lib/api/server";
import type { Profile } from "@/lib/api/types";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = { title: "Tableau de bord · Deskflow" };

const ROLE_LABELS: Record<Profile["role"], string> = {
  ADMIN: "Administrateur",
  AGENT: "Agent",
  CUSTOMER: "Client",
};

export default async function TenantHomePage({ params }: PageProps<"/[tenant]">) {
  const { tenant } = await params;
  const profile = await serverFetch<Profile>("/auth/me");

  // Le slug de l'URL n'est qu'un affichage : les données viennent du tenant du JWT
  if (profile.tenant.slug !== tenant) {
    notFound();
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1>{profile.tenant.name}</h1>
          </CardTitle>
          <CardDescription>Bienvenue, {profile.name}.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">E-mail</dt>
            <dd>{profile.email}</dd>
            <dt className="text-muted-foreground">Rôle</dt>
            <dd>{ROLE_LABELS[profile.role]}</dd>
          </dl>
          <LogoutButton />
        </CardContent>
      </Card>
    </main>
  );
}
