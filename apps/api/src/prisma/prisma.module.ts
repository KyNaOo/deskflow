import { Global, Module } from '@nestjs/common';
import { TenantContext } from '../common/tenant-context.js';
import { PrismaService } from './prisma.service.js';
import { createTenantPrisma, TENANT_PRISMA } from './tenant-prisma.js';

// Global : les clients Prisma et le contexte tenant sont injectables partout sans réimport
@Global()
@Module({
  providers: [
    PrismaService,
    TenantContext,
    {
      provide: TENANT_PRISMA,
      inject: [PrismaService, TenantContext],
      useFactory: createTenantPrisma,
    },
  ],
  exports: [PrismaService, TenantContext, TENANT_PRISMA],
})
export class PrismaModule {}
