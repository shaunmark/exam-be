/**
 * AttemptModule — Encapsulates the exam attempt lifecycle.
 *
 * Handles two endpoints:
 * - POST /attempt/start  → Create a new attempt
 * - POST /attempt/submit → Submit answers and get score
 *
 * PrismaModule is NOT imported here because it's @Global() — PrismaService
 * is automatically available for injection in AttemptService.
 *
 * AttemptService is NOT exported because no other module needs it.
 * All attempt logic is self-contained within this module.
 */
import { Module } from '@nestjs/common';
import { AttemptController } from './attempt.controller.js';
import { AttemptService } from './attempt.service.js';

@Module({
  controllers: [AttemptController],
  providers: [AttemptService],
})
export class AttemptModule {}
