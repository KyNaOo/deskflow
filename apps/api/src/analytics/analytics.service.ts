import {
  ANALYTICS_TIME_ZONE,
  type AnalyticsOverview,
  type AnalyticsPeriod,
  TICKET_STATUSES,
} from '@deskflow/shared';
import { Inject, Injectable } from '@nestjs/common';
import { TenantContext } from '../common/tenant-context.js';
import { Prisma } from '../generated/prisma/client.js';
import { TENANT_PRISMA, type TenantPrisma } from '../prisma/tenant-prisma.js';

interface Summary {
  created: number;
  unanswered: number;
  medianFirstResponse: number | null;
  medianResolution: number | null;
}

/**
 * Indicateurs du tenant, calculés par PostgreSQL : aucune liste de tickets n'est chargée en
 * mémoire. Le SQL brut échappe à l'extension Prisma d'isolation : chaque requête filtre donc
 * elle-même sur le tenant du JWT (`tenant_id = …`), ce que vérifie un test e2e d'isolation.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly tenantContext: TenantContext,
  ) {}

  async overview(period: AnalyticsPeriod): Promise<AnalyticsOverview> {
    const [summary, createdPerDay, byStatus] = await Promise.all([
      this.summary(period),
      this.createdPerDay(period),
      this.byStatus(),
    ]);

    return {
      period,
      ticketsCreated: summary.created,
      unanswered: summary.unanswered,
      medianFirstResponseSeconds: roundSeconds(summary.medianFirstResponse),
      medianResolutionSeconds: roundSeconds(summary.medianResolution),
      createdPerDay,
      byStatus,
    };
  }

  /** Médianes sur les tickets créés dans la période ; percentile_cont ignore les délais nuls. */
  private async summary({ from, to }: AnalyticsPeriod): Promise<Summary> {
    const [summary] = await this.prisma.$queryRaw<Summary[]>`
      SELECT
        count(*)::int AS created,
        count(*) FILTER (WHERE first_response_at IS NULL)::int AS unanswered,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY extract(epoch FROM first_response_at - created_at)::float8
        ) AS "medianFirstResponse",
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY extract(epoch FROM resolved_at - created_at)::float8
        ) AS "medianResolution"
      FROM tickets
      WHERE tenant_id = ${this.tenantContext.tenantId}::uuid
        AND ${localDay(Prisma.sql`created_at`)} BETWEEN ${from}::date AND ${to}::date
    `;
    return summary!;
  }

  /** Une ligne par jour de la période : generate_series fournit aussi les jours sans ticket. */
  private createdPerDay({ from, to }: AnalyticsPeriod) {
    return this.prisma.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, count(tickets.id)::int AS count
      FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS day
      LEFT JOIN tickets
        ON tickets.tenant_id = ${this.tenantContext.tenantId}::uuid
        AND ${localDay(Prisma.sql`tickets.created_at`)} = day::date
      GROUP BY day
      ORDER BY day
    `;
  }

  /** Photo du moment : passe par le client Prisma filtré, qui ajoute lui-même le tenant. */
  private async byStatus(): Promise<AnalyticsOverview['byStatus']> {
    const groups = await this.prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } });
    const counts = Object.fromEntries(TICKET_STATUSES.map((status) => [status, 0]));
    for (const { status, _count } of groups) {
      counts[status] = _count._all;
    }
    return counts as AnalyticsOverview['byStatus'];
  }
}

/**
 * Jour calendaire, à Paris, d'une colonne Prisma `DateTime` : stockée en `timestamp` sans fuseau,
 * en UTC. Un ticket ouvert à 23 h 30 à Paris compte pour ce jour-là, pas pour le lendemain (UTC).
 */
function localDay(column: Prisma.Sql) {
  return Prisma.sql`(${column} AT TIME ZONE 'UTC' AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date`;
}

function roundSeconds(seconds: number | null): number | null {
  return seconds === null ? null : Math.round(seconds);
}
