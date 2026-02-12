import { Controller, Get, Param } from '@nestjs/common';
import { ExamService } from './exam.service.js';
import { ExamResponseDto } from './dto/exam-response.dto.js';

@Controller('exam')
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @Get(':code')
  async getExam(@Param('code') code: string): Promise<ExamResponseDto> {
    return this.examService.getExamByCode(code);
  }
}
