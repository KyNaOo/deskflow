import { redirect } from "next/navigation";

export default async function TenantHomePage({ params }: PageProps<"/[tenant]">) {
  const { tenant } = await params;
  redirect(`/${tenant}/tickets`);
}
