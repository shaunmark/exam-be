/**
 * UploadModule — Encapsulates Excel file upload and parsing functionality.
 *
 * Provides a POST /upload/excel endpoint that accepts an Excel (.xlsx) file,
 * parses it, validates the data, and populates the database with exams and questions.
 *
 * This module does NOT import PrismaModule because PrismaModule is @Global().
 */
import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';

@Module({
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
