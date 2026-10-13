import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/api/profile";
import { homePath } from "@/lib/auth/paths";

/** Espace « Mes demandes » : réservé aux clients de cette organisation. */
export default async function CustomerAreaLayout({ children, params }: LayoutProps<"/portal/[tenant]/tickets">) {
  const { tenant } = await params;
  const profile = await getProfile();

  if (profile.tenant.slug !== tenant) {
    notFound();
  }
  // Un agent ou un admin traite les tickets depuis son propre espace
  if (profile.role !== "CUSTOMER") {
    redirect(homePath(profile.role, tenant));
  }
  return children;
}
