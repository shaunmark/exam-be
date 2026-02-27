/**
 * ExamService — Business logic for exam retrieval.
 *
 * This service is intentionally read-only. It only fetches exam data.
 * There are no create/update/delete operations because exam management
 * is out of scope for this MVP (exams are created via seed or direct DB access).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExamListItemDto, ExamMetaDto, ExamResponseDto, QuestionOptionDto } from './dto/exam-response.dto.js';

@Injectable()
export class ExamService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches all active exams for the listing page.
   *
   * Returns lightweight summaries (no questions) sorted by creation date (newest first).
   * Uses Prisma `_count` to get totalQuestions without fetching all question rows.
   */
  async getAllExams(): Promise<ExamListItemDto[]> {
    const exams = await this.prisma.exam.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        durationMins: true,
        totalMarks: true,
        createdAt: true,
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return exams.map(
      (exam) =>
        new ExamListItemDto({
          id: exam.id,
          code: exam.code,
          title: exam.title,
          description: exam.description,
          durationMins: exam.durationMins,
          totalMarks: exam.totalMarks,
          totalQuestions: exam._count.questions,
          createdAt: exam.createdAt,
        }),
    );
  }

  /**
   * Fetches an exam by its unique code, including all questions.
   *
   * Key behaviors:
   * 1. Only returns ACTIVE exams (isActive: true). Inactive exams return 404.
   * 2. Uses Prisma `select` to fetch ONLY the fields we need — this is both
   *    a performance optimization and a security measure.
   * 3. `correctOption` is NEVER selected — it cannot leak to the client.
   * 4. Questions are ordered by their `order` field (ascending) to ensure
   *    consistent display order across requests.
   * 5. The exam + questions are fetched in a SINGLE query (Prisma handles the
   *    JOIN internally). No N+1 problem here.
   *
   * @param code - The unique exam code (e.g., "DEMO-001")
   * @returns ExamResponseDto with exam metadata and questions (no correct answers)
   * @throws NotFoundException if exam doesn't exist or is inactive
   */
  async getExamByCode(code: string): Promise<ExamResponseDto> {
    const exam = await this.prisma.exam.findUnique({
      /**
       * `where` uses both `code` and `isActive: true`.
       * If the exam exists but is deactivated, this returns null → 404.
       * This prevents students from accessing disabled exams.
       */
      where: { code, isActive: true },
      /**
       * Explicit `select` instead of fetching the entire model.
       *
       * Why not just fetch everything?
       * - Performance: Only transfers needed data over the wire.
       * - Security: `correctOption` is excluded at the query level,
       *   so even if the DTO mapping had a bug, it could never leak.
       * - Clarity: Makes it obvious exactly what data this endpoint returns.
       */
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        durationMins: true,
        totalMarks: true,
        /**
         * Nested select for questions — Prisma generates a single SQL query
         * with a JOIN, NOT a separate query per question (no N+1).
         *
         * Notice: `correctOption` is NOT in this select list.
         */
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
            // correctOption: intentionally NOT selected — never sent to client
          },
          /** Sort questions by their display order so the frontend gets them pre-sorted. */
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with code "${code}" not found`);
    }

    /**
     * Map the Prisma result to our response DTO.
     *
     * Why not return the Prisma object directly?
     * - The Prisma object shape is tied to the DB schema and could change.
     * - DTOs provide a stable API contract for the frontend.
     * - `totalQuestions` is computed here (not stored in DB) to avoid
     *   data inconsistency if questions are added/removed later.
     */
    return new ExamResponseDto({
      id: exam.id,
      code: exam.code,
      title: exam.title,
      description: exam.description,
      durationMins: exam.durationMins,
      totalMarks: exam.totalMarks,
      /** Computed field — derived from the actual questions array length. */
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

  /**
   * Fetches exam metadata only (no questions) by its unique code.
   *
   * Key behaviors:
   * 1. Only returns ACTIVE exams (isActive: true). Inactive exams return 404.
   * 2. Uses Prisma `select` to fetch ONLY the meta fields needed.
   * 3. Uses Prisma `_count` to get totalQuestions without fetching all question rows.
   *
   * @param code - The unique exam code (e.g., "DEMO-001")
   * @returns ExamMetaDto with exam metadata only
   * @throws NotFoundException if exam doesn't exist or is inactive
   */
  async getExamMetaByCode(code: string): Promise<ExamMetaDto> {
    const exam = await this.prisma.exam.findUnique({
      where: { code, isActive: true },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        durationMins: true,
        _count: { select: { questions: true } },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with code "${code}" not found`);
    }

    return new ExamMetaDto({
      id: exam.id,
      code: exam.code,
      title: exam.title,
      description: exam.description,
      durationMins: exam.durationMins,
      totalQuestions: exam._count.questions,
    });
  }
}
