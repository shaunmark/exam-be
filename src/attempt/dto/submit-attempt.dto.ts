/**
 * DTOs for the POST /attempt/submit endpoint.
 *
 * Three DTOs are defined here:
 * 1. AnswerDto               — INPUT: A single answer within the submission.
 * 2. SubmitAttemptDto         — INPUT: The full submission payload (attemptId + answers array).
 * 3. SubmitAttemptResponseDto — OUTPUT: Score summary returned after submission.
 *
 * Validation flow:
 * Client sends JSON → NestJS ValidationPipe transforms it into SubmitAttemptDto →
 * class-validator validates all decorators → if valid, controller receives typed DTO →
 * if invalid, 400 Bad Request with detailed error messages.
 */
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Represents a single answer in the submission.
 *
 * Each answer maps a questionId to a selectedOption (A/B/C/D).
 * The client sends an array of these in the `answers` field.
 */
export class AnswerDto {
  /** The ID of the question being answered. Must match a question in the exam. */
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  /**
   * The selected option: must be exactly "A", "B", "C", or "D".
   *
   * @IsIn(['A', 'B', 'C', 'D']) ensures only valid options are accepted.
   * Any other value (e.g., "E", "a", "AB") will be rejected with a 400 error.
   * This matches the correctOption values stored in the Question model.
   */
  @IsString()
  @IsNotEmpty()
  @IsIn(['A', 'B', 'C', 'D'])
  selectedOption!: string;

  /**
   * Optional flag indicating the student marked this question for review.
   * Defaults to false if not provided. Stored in the DB for potential
   * future analytics but does NOT affect scoring.
   */
  @IsBoolean()
  @IsOptional()
  isMarkedForReview?: boolean;
}

/**
 * Input DTO for submitting an exam attempt.
 *
 * The client must provide:
 * - attemptId: The ID returned from POST /attempt/start
 * - answers: At least 1 answer (partial submissions are allowed)
 *
 * Duplicate questionIds in the answers array are handled gracefully
 * by the service (first answer wins, duplicates are silently skipped).
 */
export class SubmitAttemptDto {
  /** The attempt ID received from POST /attempt/start. */
  @IsString()
  @IsNotEmpty()
  attemptId!: string;

  /**
   * Array of answers to submit.
   *
   * - @IsArray()                    → Must be an array (not a string, object, etc.)
   * - @ArrayMinSize(1)              → At least one answer required (empty submissions rejected)
   * - @ValidateNested({ each: true }) → Validate EACH element in the array using AnswerDto's decorators
   * - @Type(() => AnswerDto)        → class-transformer converts plain objects into AnswerDto instances.
   *   Without @Type(), the nested objects would be plain JSON and @ValidateNested would not work.
   *   This is why `transform: true` is required in the global ValidationPipe.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}

/**
 * Response DTO returned after successful submission.
 *
 * Provides a complete score summary so the frontend can display results
 * immediately without making another API call.
 */
export class SubmitAttemptResponseDto {
  /** The attempt ID (same as input, echoed back for convenience). */
  attemptId: string;
  /** Total score earned. Sum of marks for all correctly answered questions. */
  score: number;
  /** Maximum possible score for this exam (sum of all question marks). */
  totalMarks: number;
  /** Total number of questions in the exam. */
  totalQuestions: number;
  /** Number of questions the student actually answered (after dedup). */
  answeredQuestions: number;
  /** Number of questions answered correctly. */
  correctAnswers: number;
  /** Server timestamp when the submission was recorded. */
  submittedAt: Date;

  constructor(partial: SubmitAttemptResponseDto) {
    this.attemptId = partial.attemptId;
    this.score = partial.score;
    this.totalMarks = partial.totalMarks;
    this.totalQuestions = partial.totalQuestions;
    this.answeredQuestions = partial.answeredQuestions;
    this.correctAnswers = partial.correctAnswers;
    this.submittedAt = partial.submittedAt;
  }
}
