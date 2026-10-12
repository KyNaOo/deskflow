import Link from "next/link";

/** Ticket ou page introuvable dans l'espace d'une organisation (y compris une ressource d'un autre tenant). */
export default function TenantNotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <p className="text-muted-foreground">Ce ticket ou cette page n’existe pas, ou vous n’y avez pas accès.</p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Retour aux tickets
      </Link>
    </div>
  );
}
