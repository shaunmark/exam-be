/**
 * ExamModule — Encapsulates all exam-related functionality.
 *
 * This module does NOT import PrismaModule because PrismaModule is @Global().
 * PrismaService is automatically available for injection in ExamService.
 *
 * ExamService is exported so other modules could potentially reuse it
 * (e.g., if AttemptModule needed to validate exam existence via ExamService).
 * Currently, AttemptModule queries the DB directly for performance reasons.
 */
import { Module } from '@nestjs/common';
import { ExamController } from './exam.controller.js';
import { ExamService } from './exam.service.js';

@Module({
  controllers: [ExamController],
  providers: [ExamService],
  /** Exported in case other modules need to reuse ExamService. */
  exports: [ExamService],
})
export class ExamModule {}
