/**
 * Root application module.
 *
 * Wires together the three core modules:
 * - PrismaModule  → Global database access (shared across all modules via @Global())
 * - ExamModule    → Read-only exam retrieval (GET /exam/:code)
 * - AttemptModule → Exam attempt lifecycle (POST /attempt/start, POST /attempt/submit)
 *
 * AppController provides a basic health-check endpoint (GET /).
 */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ExamModule } from './exam/exam.module.js';
import { AttemptModule } from './attempt/attempt.module.js';
import { UploadModule } from './upload/upload.module.js';

@Module({
  /**
   * PrismaModule is @Global(), so it doesn't need to be imported by ExamModule
   * or AttemptModule — PrismaService is automatically available everywhere.
   * We import it here at the root so it's instantiated once at app startup.
   */
  imports: [PrismaModule, ExamModule, AttemptModule, UploadModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
