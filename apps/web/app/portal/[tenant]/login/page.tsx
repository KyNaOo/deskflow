import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Connexion · Assistance" };

export default async function PortalLoginPage({ params }: PageProps<"/portal/[tenant]/login">) {
  const { tenant } = await params;

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1>Connexion</h1>
        </CardTitle>
        <CardDescription>Retrouvez vos demandes d’assistance.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <LoginForm tenantSlug={tenant} />
        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href={`/portal/${tenant}/register`} className="underline underline-offset-4">
            En créer un
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
