"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { refreshSession } from "@/lib/api/client";

export function SessionRefresher({ next }: { next: string }) {
  const router = useRouter();

  useEffect(() => {
    // Le double appel de l'effet en développement (StrictMode) partage la même promesse
    void refreshSession().then((renewed) => router.replace(renewed ? next : "/login"));
  }, [next, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <p role="status" className="text-sm text-muted-foreground">
        Reconnexion…
      </p>
    </main>
  );
}
