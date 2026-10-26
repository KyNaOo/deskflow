import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { Button } from "@/components/ui/button";
import { getOptionalProfile } from "@/lib/api/profile";
import { serverFetch } from "@/lib/api/server";
import type { PublicTenant } from "@/lib/api/types";

/** Portail public d'une organisation : ses clients y ouvrent et suivent leurs demandes. */
export default async function PortalLayout({ children, params }: LayoutProps<"/portal/[tenant]">) {
  const { tenant } = await params;
  const [organization, profile] = await Promise.all([
    serverFetch<PublicTenant>(`/tenants/${tenant}`),
    getOptionalProfile(),
  ]);
  const customer = profile?.role === "CUSTOMER" && profile.tenant.slug === tenant ? profile : null;

  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <SkipLink />
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-6">
          <Link href={`/portal/${tenant}`} className="font-semibold">
            {organization.name} <span className="font-normal text-muted-foreground">· Assistance</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            {customer ? (
              <>
                <span className="text-sm text-muted-foreground">{customer.name}</span>
                <LogoutButton redirectTo={`/portal/${tenant}`} />
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/portal/${tenant}/login`}>Se connecter</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/portal/${tenant}/register`}>Créer un compte</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main id={MAIN_CONTENT_ID} className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
