/**
 * UploadController — HTTP layer for Excel file upload.
 *
 * Provides a single endpoint:
 *   POST /upload/excel — Accepts an .xlsx file and populates the database.
 *
 * Uses Multer for multipart file handling (memory storage — file stays in RAM).
 * The file buffer is passed directly to UploadService for parsing.
 */
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service.js';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /upload/excel
   *
   * Accepts a multipart form-data request with a single file field named "file".
   * The file must be an .xlsx Excel workbook with two sheets:
   *   - Sheet 1 ("Exams"):     exam metadata rows
   *   - Sheet 2 ("Questions"): question rows linked to exams by examCode
   *
   * Returns a summary of created exams and questions, or validation errors.
   */
  @Post('excel')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only .xlsx files are allowed'), false);
        }
      },
    }),
  )
  async uploadExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Send a .xlsx file under the "file" field.');
    }

    return this.uploadService.parseAndPopulate(file.buffer);
  }
}
