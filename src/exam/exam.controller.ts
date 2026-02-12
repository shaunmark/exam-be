/**
 * ExamController — HTTP layer for exam retrieval.
 *
 * This controller is intentionally THIN. It only:
 * 1. Extracts the route parameter (:code)
 * 2. Delegates to ExamService for all business logic
 * 3. Returns the DTO directly (NestJS serializes it to JSON)
 *
 * No business logic, no data transformation, no direct DB access.
 * This separation makes the service independently testable.
 *
 * Route prefix: /exam
 */
import { Controller, Get, Param } from '@nestjs/common';
import { ExamService } from './exam.service.js';
import { ExamListItemDto, ExamResponseDto } from './dto/exam-response.dto.js';

@Controller('exam')
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  /**
   * GET /exam
   *
   * Returns all active exams as lightweight summaries (no questions).
   * Used by the frontend to render the exam listing/selection page.
   * Sorted by creation date (newest first).
   */
  @Get()
  async getAllExams(): Promise<ExamListItemDto[]> {
    return this.examService.getAllExams();
  }

  /**
   * GET /exam/:code
   *
   * Retrieves exam metadata and questions by exam code.
   * The `code` param is extracted from the URL path (e.g., /exam/DEMO-001).
   *
   * Returns: ExamResponseDto (exam info + questions WITHOUT correct answers)
   * Throws:  404 if exam not found or inactive
   */
  @Get(':code')
  async getExam(@Param('code') code: string): Promise<ExamResponseDto> {
    return this.examService.getExamByCode(code);
  }
}
