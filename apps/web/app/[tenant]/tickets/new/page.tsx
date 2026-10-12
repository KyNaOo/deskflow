import type { Metadata } from "next";
import Link from "next/link";
import { serverFetch } from "@/lib/api/server";
import type { Member } from "@/lib/api/types";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "Nouveau ticket · Deskflow" };

/** Un agent ouvre un ticket pour un client (ex. demande reçue par téléphone). */
export default async function NewTicketPage({ params }: PageProps<"/[tenant]/tickets/new">) {
  const { tenant } = await params;
  const members = await serverFetch<Member[]>("/users");
  const customers = members.filter((member) => member.role === "CUSTOMER");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/${tenant}/tickets`} className="text-sm text-muted-foreground hover:underline">
          ← Tickets
        </Link>
        <h1 className="text-2xl font-semibold">Nouveau ticket</h1>
      </div>
      {customers.length > 0 ? (
        <NewTicketForm tenant={tenant} customers={customers} />
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Aucun client dans l’organisation : ils créent leur compte depuis le portail.
        </p>
      )}
    </div>
  );
}
