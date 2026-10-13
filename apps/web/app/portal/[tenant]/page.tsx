import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getOptionalProfile } from "@/lib/api/profile";
import { homePath } from "@/lib/auth/paths";

/** Accueil du portail : un utilisateur déjà connecté à cette organisation va directement à son espace. */
export default async function PortalHomePage({ params }: PageProps<"/portal/[tenant]">) {
  const { tenant } = await params;
  const profile = await getOptionalProfile();
  if (profile?.tenant.slug === tenant) {
    redirect(homePath(profile.role, tenant));
  }

  return (
    <section className="flex flex-col items-start gap-4 py-10">
      <h1 className="text-3xl font-semibold">Besoin d’aide ?</h1>
      <p className="max-w-xl text-muted-foreground">
        Décrivez votre problème : notre équipe vous répond ici, et vous suivez l’avancement de chacune de vos
        demandes.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href={`/portal/${tenant}/register`}>Créer un compte</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/portal/${tenant}/login`}>J’ai déjà un compte</Link>
        </Button>
      </div>
    </section>
  );
}
