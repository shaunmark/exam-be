/**
 * PrismaService — Central database access layer.
 *
 * Extends PrismaClient so that any module can inject PrismaService and
 * directly call `this.prisma.exam.findUnique(...)`, `this.prisma.$transaction(...)`, etc.
 *
 * Key design choices:
 * 1. Uses @prisma/adapter-neon (PrismaNeon) instead of the default PostgreSQL driver.
 *    This is REQUIRED for Neon serverless PostgreSQL, which communicates over
 *    HTTP/WebSocket rather than the standard PostgreSQL wire protocol.
 *
 * 2. Implements OnModuleInit / OnModuleDestroy for proper connection lifecycle:
 *    - onModuleInit:    Opens the DB connection when NestJS starts up.
 *    - onModuleDestroy: Cleanly closes the DB connection on app shutdown.
 *    This prevents connection leaks and ensures graceful shutdown.
 *
 * 3. DATABASE_URL is read from process.env at construction time.
 *    The `!` (non-null assertion) is safe here because the app should not
 *    start without a valid DATABASE_URL — it will fail at $connect() if missing.
 */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    /**
     * Create a Neon adapter with the connection string from environment.
     * PrismaNeon handles the HTTP/WebSocket transport to Neon's serverless proxy.
     * This replaces the default libpq-based driver that PrismaClient normally uses.
     */
    const adapter = new PrismaNeon({
      connectionString: process.env.DATABASE_URL!,
    });

    /**
     * Pass the adapter to PrismaClient's constructor.
     * This tells Prisma to use the Neon driver for ALL database operations
     * (queries, transactions, raw SQL, etc.) instead of the built-in engine.
     */
    super({ adapter });
  }

  /** Called automatically by NestJS when the module initializes. Opens DB connection. */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Called automatically by NestJS on app shutdown. Closes DB connection cleanly. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
