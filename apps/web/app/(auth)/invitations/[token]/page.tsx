import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInvitationForm } from "./accept-invitation-form";

export const metadata: Metadata = { title: "Invitation · Deskflow" };

export default async function InvitationPage({ params }: PageProps<"/invitations/[token]">) {
  const { token } = await params;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Rejoindre l’organisation</h1>
        </CardTitle>
        <CardDescription>Choisissez votre nom et votre mot de passe.</CardDescription>
      </CardHeader>
      <CardContent>
        <AcceptInvitationForm token={token} />
      </CardContent>
    </Card>
  );
}
