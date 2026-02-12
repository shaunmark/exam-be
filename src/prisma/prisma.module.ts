/**
 * Global Prisma module.
 *
 * @Global() makes PrismaService available to ALL modules in the application
 * without needing to add PrismaModule to each module's imports array.
 * This ensures a single shared database connection pool across the entire app.
 *
 * Why global?
 * - Every module (Exam, Attempt) needs database access.
 * - Without @Global(), each module would need to explicitly import PrismaModule.
 * - A single PrismaService instance avoids multiple connection pools.
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  /** Export PrismaService so other modules can inject it via constructor DI. */
  exports: [PrismaService],
})
export class PrismaModule {}
