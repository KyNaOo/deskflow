import { analyticsQuerySchema } from '@deskflow/shared';
import { createZodDto } from '../../common/zod-validation.js';

export class AnalyticsQueryDto extends createZodDto(analyticsQuerySchema) {}
