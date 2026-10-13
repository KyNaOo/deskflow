"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

/** Déconnexion, puis retour à la page de connexion (celle du portail pour un client). */
export function LogoutButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      // La session a changé : les layouts déjà affichés (en-tête…) doivent être relus
      router.replace(redirectTo);
      router.refresh();
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={logout} disabled={pending}>
      Se déconnecter
    </Button>
  );
}
