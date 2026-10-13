import type { Metadata } from "next";
import Link from "next/link";
import { NewRequestForm } from "./new-request-form";

export const metadata: Metadata = { title: "Nouvelle demande · Assistance" };

export default async function NewRequestPage({ params }: PageProps<"/portal/[tenant]/tickets/new">) {
  const { tenant } = await params;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/portal/${tenant}/tickets`} className="text-sm text-muted-foreground hover:underline">
          ← Mes demandes
        </Link>
        <h1 className="text-2xl font-semibold">Nouvelle demande</h1>
      </div>
      <NewRequestForm tenant={tenant} />
    </div>
  );
}
