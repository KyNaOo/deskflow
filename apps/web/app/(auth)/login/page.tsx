import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion · Deskflow" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Connexion</h1>
        </CardTitle>
        <CardDescription>Connectez-vous à l’espace de votre organisation.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          Pas encore d’organisation ?{" "}
          <Link href="/register" className="underline underline-offset-4">
            Créer un espace
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
