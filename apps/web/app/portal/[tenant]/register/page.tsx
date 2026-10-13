import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterCustomerForm } from "./register-customer-form";

export const metadata: Metadata = { title: "Créer un compte · Assistance" };

export default async function PortalRegisterPage({ params }: PageProps<"/portal/[tenant]/register">) {
  const { tenant } = await params;

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1>Créer un compte</h1>
        </CardTitle>
        <CardDescription>Pour ouvrir des demandes et suivre les réponses de l’équipe.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <RegisterCustomerForm tenantSlug={tenant} />
        <p className="text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link href={`/portal/${tenant}/login`} className="underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
