/**
 * Prisma 7 Configuration File.
 *
 * In Prisma 7, the `url` property was REMOVED from the `datasource` block in schema.prisma.
 * Instead, the connection URL must be provided here via `datasource.url`.
 *
 * Why does this file exist?
 * - Prisma 7 introduced `prisma.config.ts` as the central configuration file.
 * - It replaces the old `datasource { url = env("DATABASE_URL") }` pattern in schema.prisma.
 * - This file is used by ALL Prisma CLI commands: migrate, generate, seed, studio, etc.
 *
 * Why do we need dotenv.config()?
 * - Unlike NestJS (which auto-loads .env via ConfigModule), Prisma 7's config file
 *   does NOT auto-load .env files. Without dotenv.config(), process.env.DATABASE_URL
 *   would be undefined, and migrations would fail with:
 *   "The datasource.url property is required in your Prisma config file"
 *
 * IMPORTANT: This file is EXCLUDED from the NestJS build (see tsconfig.build.json)
 * because it uses `prisma/config` imports that are not compatible with the NestJS compiler.
 */
import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

/** Load .env file BEFORE accessing process.env.DATABASE_URL. */
dotenv.config();

export default defineConfig({
  /** Path to the Prisma schema file. Uses __dirname for reliable resolution. */
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  /**
   * Database connection URL for Prisma CLI commands (migrate, seed, studio).
   * At runtime, the NestJS app uses PrismaNeon adapter instead (see prisma.service.ts).
   * The `!` asserts DATABASE_URL is defined — if not, Prisma will error clearly.
   */
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  /**
   * Migration configuration with seed script.
   * The seed will automatically run after migrations complete.
   */
  migrations: {
    seed: 'ts-node ./prisma/seed.ts',
  },
});
