/**
 * AttemptService — Core business logic for exam attempts.
 *
 * This is the most critical service in the application. It handles:
 * 1. Starting an exam attempt (startAttempt)
 * 2. Submitting answers and calculating scores (submitAttempt)
 *
 * Design principles followed:
 * - All business logic lives HERE, not in the controller.
 * - Every DB query uses `select` to fetch only needed fields.
 * - No N+1 queries — questions are fetched in bulk and scored via Map lookup.
 * - Transactional safety — answer insertion + attempt update are atomic.
 * - Defensive validation — checks for duplicates, timeouts, and invalid questions.
 *
 * Error handling strategy:
 * - NotFoundException (404) → Resource doesn't exist
 * - ConflictException (409) → Business rule violation (duplicate attempt, already submitted)
 * - BadRequestException (400) → Invalid input or expired time
 */
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

  /**
   * Starts a new exam attempt for a user.
   *
   * Flow:
   * 1. Validate that the exam exists and is active.
   * 2. Check if the user already has an attempt for this exam (prevent duplicates).
   * 3. Calculate the end time (now + exam duration).
   * 4. Create the attempt record with status IN_PROGRESS.
   * 5. Return attempt metadata (id, startedAt, endsAt) for the frontend timer.
   *
   * @param dto - Contains userId and examCode
   * @returns StartAttemptResponseDto with attemptId and time boundaries
   * @throws NotFoundException if exam doesn't exist or is inactive
   * @throws ConflictException if user already has an attempt (active or completed)
   */
  async startAttempt(dto: StartAttemptDto): Promise<StartAttemptResponseDto> {
    /**
     * Step 1: Look up the exam by its unique code.
     * We only need `id` (to create the attempt) and `durationMins` (to calculate endsAt).
     * The `isActive: true` filter ensures deactivated exams can't be started.
     */
    const exam = await this.prisma.exam.findUnique({
      where: { code: dto.examCode, isActive: true },
      select: { id: true, durationMins: true },
    });

    if (!exam) {
      throw new NotFoundException(
        `Exam with code "${dto.examCode}" not found or is inactive`,
      );
    }

    /**
     * Step 2: Check for existing attempt.
     *
     * The DB has a @@unique([userId, examId]) constraint on ExamAttempt, which
     * would prevent duplicate inserts at the database level. However, if we just
     * tried to create and caught the constraint error, the error message would be
     * a raw Prisma error — not user-friendly.
     *
     * Instead, we check first and return a clear 409 Conflict message.
     * We use `findUnique` on the composite unique index `userId_examId` for
     * an efficient indexed lookup (no table scan).
     *
     * We differentiate between:
     * - IN_PROGRESS: "You already have an active attempt" (could resume in future)
     * - SUBMITTED/TIMED_OUT: "You have already attempted this exam" (no retakes)
     */
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

    /**
     * Step 3: Calculate time boundaries.
     *
     * `now` is captured once and reused for both `startedAt` and the `endsAt` calculation.
     * This ensures consistency — if we called `new Date()` twice, there could be a
     * millisecond difference between startedAt and the base of endsAt.
     *
     * `endsAt` = now + (durationMins * 60 * 1000) converts minutes to milliseconds.
     * The frontend uses endsAt to display a countdown timer.
     */
    const now = new Date();
    const endsAt = new Date(now.getTime() + exam.durationMins * 60 * 1000);

    /**
     * Step 4: Create the attempt record.
     *
     * Status starts as IN_PROGRESS. It will transition to:
     * - SUBMITTED: When the student submits within the time limit
     * - TIMED_OUT: When the student submits after the deadline (within grace period)
     *
     * We use `select` to only return the fields needed for the response DTO.
     */
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

    /** Step 5: Map to response DTO and return. */
    return new StartAttemptResponseDto({
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      endsAt: attempt.endsAt,
    });
  }

  /**
   * Submits answers for an exam attempt and calculates the score.
   *
   * This is the most complex method in the application. It handles:
   * 1. Validating the attempt exists and is still IN_PROGRESS.
   * 2. Checking if the exam time has expired (with a 5-second grace period).
   * 3. Fetching ALL questions in one query (avoids N+1).
   * 4. Scoring answers using an in-memory Map for O(1) lookups.
   * 5. Deduplicating answers (first answer per question wins).
   * 6. Atomically persisting answers + updating attempt status in a transaction.
   *
   * Performance characteristics:
   * - 2 DB reads (attempt + questions) + 1 transaction (2 writes) = 4 DB operations total.
   * - Scoring is O(n) where n = number of answers submitted.
   * - No N+1: Questions are fetched once, not per-answer.
   *
   * @param dto - Contains attemptId and answers array
   * @returns SubmitAttemptResponseDto with score summary
   * @throws NotFoundException if attempt doesn't exist
   * @throws ConflictException if attempt already submitted
   * @throws BadRequestException if time expired or question doesn't belong to exam
   */
  async submitAttempt(
    dto: SubmitAttemptDto,
  ): Promise<SubmitAttemptResponseDto> {
    /**
     * STEP 1: Fetch the attempt along with its exam's totalMarks.
     *
     * We use a nested `select` on `exam` to get totalMarks in the SAME query
     * (Prisma generates a JOIN). This avoids a separate query for exam data.
     *
     * Fields fetched:
     * - id, status: To validate the attempt is still submittable
     * - endsAt: To check if the exam time has expired
     * - examId: To fetch questions for this exam
     * - exam.totalMarks: For the response DTO (score out of totalMarks)
     */
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

    /**
     * Only IN_PROGRESS attempts can be submitted.
     * SUBMITTED and TIMED_OUT attempts are final — no re-submission allowed.
     * This prevents score manipulation by submitting multiple times.
     */
    if (attempt.status !== 'IN_PROGRESS') {
      throw new ConflictException('This attempt has already been submitted');
    }

    const now = new Date();
    /**
     * Track whether the submission arrived after the deadline.
     * If true but within grace period, we still accept the answers but
     * mark the attempt as TIMED_OUT instead of SUBMITTED.
     */
    const isTimedOut = now > attempt.endsAt;

    /**
     * STEP 2: Handle time expiration with a grace period.
     *
     * Why a grace period?
     * - Network latency: The client's "submit" request might take a few seconds
     *   to reach the server after the timer hits zero on the frontend.
     * - UX fairness: Penalizing students for 1-2 seconds of network delay is unfair.
     *
     * Grace period logic:
     * - Within deadline (now <= endsAt): Accept normally → status = SUBMITTED
     * - Within grace period (endsAt < now <= endsAt + 5s): Accept → status = TIMED_OUT
     * - Past grace period (now > endsAt + 5s): Reject entirely → score = 0, throw error
     *
     * The 5-second value (GRACE_PERIOD_MS) is a reasonable default.
     * In production, this could be configurable per exam.
     */
    const GRACE_PERIOD_MS = 5000;
    if (now.getTime() > attempt.endsAt.getTime() + GRACE_PERIOD_MS) {
      /**
       * Well past the deadline — reject the submission entirely.
       * Mark the attempt as TIMED_OUT with score 0 so it can't be submitted again.
       * This is a "fire and forget" update — we don't need the result.
       */
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

    /**
     * STEP 3: Fetch ALL questions for this exam in ONE query.
     *
     * This is the key N+1 prevention strategy:
     * - NAIVE approach: For each answer, query the DB to get the correct option.
     *   With 50 answers, that's 50 DB queries. Terrible for performance.
     * - OUR approach: Fetch all questions once, build an in-memory Map,
     *   then look up each answer in O(1). Total: 1 DB query regardless of answer count.
     *
     * We only select id, correctOption, and marks — the minimum needed for scoring.
     */
    const questions = await this.prisma.question.findMany({
      where: { examId: attempt.examId },
      select: {
        id: true,
        correctOption: true,
        marks: true,
      },
    });

    /**
     * Build a Map<questionId, { correctOption, marks }> for O(1) lookups.
     *
     * Why a Map instead of an object?
     * - Maps have guaranteed O(1) lookup (hash-based).
     * - Maps don't have prototype pollution issues.
     * - Maps have a cleaner API (.get(), .has()) for this use case.
     */
    const questionMap = new Map(
      questions.map((q) => [q.id, { correctOption: q.correctOption, marks: q.marks }]),
    );

    /**
     * STEP 4: Iterate through submitted answers, validate, and calculate score.
     *
     * We track:
     * - seenQuestionIds: Set to detect and skip duplicate answers for the same question.
     * - score: Running total of marks earned.
     * - correctAnswers: Count of correctly answered questions.
     * - answersToCreate: Array of answer records to batch-insert into the DB.
     */
    const seenQuestionIds = new Set<string>();
    let score = 0;
    let correctAnswers = 0;

    /**
     * Pre-typed array for the batch insert.
     * Each element matches the AttemptAnswer model's required fields.
     * selectedOption can be null for unanswered questions.
     */
    const answersToCreate: Array<{
      attemptId: string;
      questionId: string;
      selectedOption: string | null;
      isMarkedForReview: boolean;
      isCorrect: boolean;
    }> = [];

    for (const answer of dto.answers) {
      /**
       * Duplicate deduplication: If the client sends two answers for the same
       * question (e.g., user changed their mind), we take the FIRST one and
       * silently skip the rest. This prevents a DB unique constraint error on
       * @@unique([attemptId, questionId]) and gives deterministic behavior.
       */
      if (seenQuestionIds.has(answer.questionId)) {
        continue;
      }
      seenQuestionIds.add(answer.questionId);

      /**
       * Validate that the question belongs to this exam.
       * If someone sends a questionId from a different exam, reject it.
       * This prevents cross-exam answer injection.
       */
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new BadRequestException(
          `Question "${answer.questionId}" does not belong to this exam`,
        );
      }

      /**
       * Score calculation: Handle unanswered questions.
       * 
       * - If selectedOption is null/undefined, question is unanswered → incorrect (0 marks)
       * - If selectedOption is provided, compare with correctOption
       * - No partial credit, no negative marking — just full marks or zero
       */
      const isCorrect = answer.selectedOption 
        ? answer.selectedOption === question.correctOption 
        : false;
      
      if (isCorrect) {
        score += question.marks;
        correctAnswers++;
      }

      /**
       * Build the answer record for batch insert.
       * `isMarkedForReview` defaults to false if not provided by the client.
       * `isCorrect` is computed and stored — avoids recomputation later.
       * `selectedOption` can be null for unanswered questions.
       */
      answersToCreate.push({
        attemptId: attempt.id,
        questionId: answer.questionId,
        selectedOption: answer.selectedOption ?? null,
        isMarkedForReview: answer.isMarkedForReview ?? false,
        isCorrect,
      });
    }

    /**
     * STEP 5: Persist everything atomically using a Prisma transaction.
     *
     * Why a transaction?
     * - Without it, if createMany succeeds but the update fails, we'd have
     *   orphaned answers with an attempt still marked as IN_PROGRESS.
     * - With a transaction, BOTH operations succeed or BOTH are rolled back.
     *   The database is NEVER left in an inconsistent state.
     *
     * The transaction contains exactly 2 operations:
     * 1. createMany: Batch-insert all answers in a single INSERT statement.
     *    This is much faster than inserting one-by-one in a loop.
     * 2. update: Set the attempt's score, submittedAt, and final status.
     *
     * `finalStatus` is SUBMITTED if within deadline, TIMED_OUT if past deadline
     * but within the grace period.
     */
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

    /**
     * STEP 6: Return the score summary.
     *
     * All data needed for the results screen is included so the frontend
     * doesn't need to make another API call after submission.
     */
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
