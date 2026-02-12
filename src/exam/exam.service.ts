import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExamResponseDto, QuestionOptionDto } from './dto/exam-response.dto.js';

@Injectable()
export class ExamService {
  constructor(private readonly prisma: PrismaService) {}

  async getExamByCode(code: string): Promise<ExamResponseDto> {
    const exam = await this.prisma.exam.findUnique({
      where: { code, isActive: true },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        durationMins: true,
        totalMarks: true,
        questions: {
          select: {
            id: true,
            text: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            order: true,
            marks: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with code "${code}" not found`);
    }

    return new ExamResponseDto({
      id: exam.id,
      code: exam.code,
      title: exam.title,
      description: exam.description,
      durationMins: exam.durationMins,
      totalMarks: exam.totalMarks,
      totalQuestions: exam.questions.length,
      questions: exam.questions.map(
        (q) =>
          new QuestionOptionDto({
            id: q.id,
            text: q.text,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            order: q.order,
            marks: q.marks,
          }),
      ),
    });
  }
}
