import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  StartAttemptDto,
  StartAttemptResponseDto,
} from './dto/start-attempt.dto.js';
import {
  SubmitAttemptDto,
  SubmitAttemptResponseDto,
} from './dto/submit-attempt.dto.js';

@Injectable()
export class AttemptService {
  constructor(private readonly prisma: PrismaService) {}

  async startAttempt(dto: StartAttemptDto): Promise<StartAttemptResponseDto> {
    const exam = await this.prisma.exam.findUnique({
      where: { code: dto.examCode, isActive: true },
      select: { id: true, durationMins: true },
    });

    if (!exam) {
      throw new NotFoundException(
        `Exam with code "${dto.examCode}" not found or is inactive`,
      );
    }

    // Check for existing attempt — @@unique([userId, examId]) enforces one attempt per user per exam.
    // We use a findFirst check to give a friendly error instead of a raw DB constraint error.
    const existingAttempt = await this.prisma.examAttempt.findUnique({
      where: {
        userId_examId: {
          userId: dto.userId,
          examId: exam.id,
        },
      },
      select: { id: true, status: true },
    });

    if (existingAttempt) {
      if (existingAttempt.status === 'IN_PROGRESS') {
        throw new ConflictException(
          'You already have an active attempt for this exam',
        );
      }
      throw new ConflictException(
        'You have already attempted this exam',
      );
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + exam.durationMins * 60 * 1000);

    const attempt = await this.prisma.examAttempt.create({
      data: {
        userId: dto.userId,
        examId: exam.id,
        startedAt: now,
        endsAt,
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        startedAt: true,
        endsAt: true,
      },
    });

    return new StartAttemptResponseDto({
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      endsAt: attempt.endsAt,
    });
  }

  async submitAttempt(
    dto: SubmitAttemptDto,
  ): Promise<SubmitAttemptResponseDto> {
    // 1. Fetch attempt with exam info in a single query
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: dto.attemptId },
      select: {
        id: true,
        status: true,
        endsAt: true,
        examId: true,
        exam: {
          select: {
            totalMarks: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new ConflictException('This attempt has already been submitted');
    }

    const now = new Date();
    const isTimedOut = now > attempt.endsAt;

    // Allow a small grace period (5 seconds) for network latency
    const GRACE_PERIOD_MS = 5000;
    if (now.getTime() > attempt.endsAt.getTime() + GRACE_PERIOD_MS) {
      // Auto-mark as timed out with score 0 if well past deadline
      await this.prisma.examAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'TIMED_OUT',
          score: 0,
          submittedAt: now,
        },
      });
      throw new BadRequestException(
        'Exam time has expired. Attempt marked as timed out.',
      );
    }

    // 2. Fetch all questions for this exam in one query (avoid N+1)
    const questions = await this.prisma.question.findMany({
      where: { examId: attempt.examId },
      select: {
        id: true,
        correctOption: true,
        marks: true,
      },
    });

    // Build a lookup map for O(1) access per answer
    const questionMap = new Map(
      questions.map((q) => [q.id, { correctOption: q.correctOption, marks: q.marks }]),
    );

    // 3. Validate answers and calculate score deterministically
    const seenQuestionIds = new Set<string>();
    let score = 0;
    let correctAnswers = 0;

    const answersToCreate: Array<{
      attemptId: string;
      questionId: string;
      selectedOption: string;
      isMarkedForReview: boolean;
      isCorrect: boolean;
    }> = [];

    for (const answer of dto.answers) {
      // Skip duplicate question answers — take the first one
      if (seenQuestionIds.has(answer.questionId)) {
        continue;
      }
      seenQuestionIds.add(answer.questionId);

      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new BadRequestException(
          `Question "${answer.questionId}" does not belong to this exam`,
        );
      }

      const isCorrect = answer.selectedOption === question.correctOption;
      if (isCorrect) {
        score += question.marks;
        correctAnswers++;
      }

      answersToCreate.push({
        attemptId: attempt.id,
        questionId: answer.questionId,
        selectedOption: answer.selectedOption,
        isMarkedForReview: answer.isMarkedForReview ?? false,
        isCorrect,
      });
    }

    // 4. Use a transaction to atomically insert answers + update attempt
    const submittedAt = new Date();
    const finalStatus = isTimedOut ? 'TIMED_OUT' as const : 'SUBMITTED' as const;

    await this.prisma.$transaction([
      this.prisma.attemptAnswer.createMany({
        data: answersToCreate,
      }),
      this.prisma.examAttempt.update({
        where: { id: attempt.id },
        data: {
          score,
          submittedAt,
          status: finalStatus,
        },
      }),
    ]);

    return new SubmitAttemptResponseDto({
      attemptId: attempt.id,
      score,
      totalMarks: attempt.exam.totalMarks,
      totalQuestions: questions.length,
      answeredQuestions: answersToCreate.length,
      correctAnswers,
      submittedAt,
    });
  }
}
