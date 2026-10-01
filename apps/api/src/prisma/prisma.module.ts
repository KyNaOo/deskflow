import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// Global : PrismaService est injectable dans tous les modules sans réimport
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
