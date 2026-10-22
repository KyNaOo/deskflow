import { type AnalyticsOverview, TICKET_STATUSES } from "@deskflow/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { serverFetch } from "@/lib/api/server";
import { getProfile } from "@/lib/api/profile";
import { formatDuration, formatLongDay, ticketCount } from "@/lib/analytics/format";
import { parsePeriod, periodRange } from "@/lib/analytics/period";
import { STATUS_LABELS } from "@/lib/tickets/labels";
import { CreatedPerDayChart } from "./created-per-day-chart";
import { PeriodSelector } from "./period-selector";
import { StatusChart, type StatusCount } from "./status-chart";

export const metadata: Metadata = { title: "Tableau de bord · Deskflow" };

/**
 * Server Component : les indicateurs arrivent avec le HTML. Seuls les deux graphiques sont des
 * composants client (Recharts mesure et dessine dans le navigateur) ; ils reçoivent leurs données.
 */
export default async function DashboardPage({ params, searchParams }: PageProps<"/[tenant]/dashboard">) {
  const { tenant } = await params;
  // Réservé aux admins (l'API renverrait 403) : un agent est renvoyé vers ses tickets
  if ((await getProfile()).role !== "ADMIN") {
    redirect(`/${tenant}/tickets`);
  }

  const days = parsePeriod(await searchParams);
  const { from, to } = periodRange(days);
  const overview = await serverFetch<AnalyticsOverview>(`/analytics/overview?${new URLSearchParams({ from, to })}`);
  const statuses: StatusCount[] = TICKET_STATUSES.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: overview.byStatus[status],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            Tickets créés du {formatLongDay(from)} au {formatLongDay(to)}
          </p>
        </div>
        <PeriodSelector basePath={`/${tenant}/dashboard`} current={days} />
      </div>

      <section aria-label="Chiffres clés" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tickets créés" value={String(overview.ticketsCreated)} />
        <StatCard
          label="Sans réponse"
          value={String(overview.unanswered)}
          hint="Parmi les tickets créés, en attente d’une première réponse"
        />
        <StatCard
          label="Première réponse"
          value={durationOrDash(overview.medianFirstResponseSeconds)}
          hint="Délai médian entre l’ouverture et la première réponse d’un agent"
        />
        <StatCard
          label="Résolution"
          value={durationOrDash(overview.medianResolutionSeconds)}
          hint="Délai médian entre l’ouverture et la résolution"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Tickets créés par jour"
          summary={dailySummary(overview.createdPerDay, overview.ticketsCreated)}
          table={{
            headers: ["Jour", "Tickets créés"],
            rows: overview.createdPerDay.map(({ day, count }) => [formatLongDay(day), String(count)]),
          }}
        >
          {/* key : un changement de période recrée le graphique, sans garder le survol de l'ancienne */}
          <CreatedPerDayChart key={from} data={overview.createdPerDay} />
        </ChartCard>
        <ChartCard
          title="Tickets par statut"
          summary="Répartition actuelle de tous les tickets, quelle que soit leur date."
          table={{ headers: ["Statut", "Tickets"], rows: statuses.map(({ label, count }) => [label, String(count)]) }}
        >
          <StatusChart data={statuses} />
        </ChartCard>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold">{value}</CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  );
}

interface ChartCardProps {
  title: string;
  /** Lecture du graphique en une phrase, pour tous (et seule lecture pour un lecteur d'écran) */
  summary: string;
  /** Mêmes données en tableau : alternative au graphique, consultable au clavier */
  table: { headers: [string, string]; rows: string[][] };
  className?: string;
  children: React.ReactNode;
}

function ChartCard({ title, summary, table, className, children }: ChartCardProps) {
  return (
    <Card className={className}>
      <figure className="contents">
        <CardHeader>
          <figcaption>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{summary}</CardDescription>
          </figcaption>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div aria-hidden="true">{children}</div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Voir les données</summary>
            <table className="mt-2 w-full tabular-nums">
              <thead>
                <tr className="text-left text-muted-foreground">
                  {table.headers.map((header) => (
                    <th key={header} scope="col" className="py-1 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map(([label, value]) => (
                  <tr key={label} className="border-t">
                    <th scope="row" className="py-1 text-left font-normal">
                      {label}
                    </th>
                    <td className="py-1">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </CardContent>
      </figure>
    </Card>
  );
}

function durationOrDash(seconds: number | null): string {
  return seconds === null ? "—" : formatDuration(seconds);
}

function dailySummary(days: AnalyticsOverview["createdPerDay"], total: number): string {
  if (total === 0) {
    return "Aucun ticket créé sur la période.";
  }
  const busiest = days.reduce((max, day) => (day.count > max.count ? day : max));
  return `${ticketCount(total)} sur la période, au plus ${busiest.count} par jour (${formatLongDay(busiest.day)}).`;
}
