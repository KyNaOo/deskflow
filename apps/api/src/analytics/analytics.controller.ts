import { analyticsQuerySchema, type AnalyticsPeriod } from '@deskflow/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('analytics')
@Roles(Role.ADMIN)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** `GET /analytics/overview?from=2026-10-01&to=2026-10-31` (30 derniers jours par défaut) */
  @Get('overview')
  overview(@Query({ schema: analyticsQuerySchema }) query: AnalyticsPeriod) {
    return this.analytics.overview(query);
  }
}
