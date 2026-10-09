import { Global, Module } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from './prisma.service.js';
import { createTenantPrisma, TENANT_PRISMA } from './tenant-prisma.js';

// Global : les clients Prisma sont injectables dans tous les modules sans réimport
@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: TENANT_PRISMA,
      inject: [PrismaService, ClsService],
      useFactory: createTenantPrisma,
    },
  ],
  exports: [PrismaService, TENANT_PRISMA],
})
export class PrismaModule {}
