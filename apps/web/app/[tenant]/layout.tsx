import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/api/profile";
import { LogoutButton } from "./logout-button";
import { MainNav } from "./main-nav";

/** Espace des agents et admins d'une organisation. */
export default async function TenantLayout({ children, params }: LayoutProps<"/[tenant]">) {
  const { tenant } = await params;
  const profile = await getProfile();

  // Le slug de l'URL n'est qu'un affichage : les données viennent du tenant du JWT
  if (profile.tenant.slug !== tenant) {
    notFound();
  }
  // Les clients ont leur propre espace : le portail de l'organisation
  if (profile.role === "CUSTOMER") {
    redirect(`/portal/${tenant}`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
          <Link href={`/${tenant}/tickets`} className="font-semibold">
            {profile.tenant.name}
          </Link>
          <MainNav tenant={tenant} />
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{profile.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
