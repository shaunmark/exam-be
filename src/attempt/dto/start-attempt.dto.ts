/**
 * DTOs for the POST /attempt/start endpoint.
 *
 * Two DTOs are defined here:
 * 1. StartAttemptDto      — INPUT: Validated request body from the client.
 * 2. StartAttemptResponseDto — OUTPUT: Shaped response sent back to the client.
 */
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Input DTO for starting an exam attempt.
 *
 * Validated automatically by NestJS's global ValidationPipe.
 * If any validation fails, NestJS returns a 400 Bad Request with details.
 *
 * NOTE: There is no authentication in this MVP. The userId is passed directly
 * by the client. In production, this would come from a JWT token or session.
 *
 * The `!` (definite assignment assertion) is required because TypeScript strict
 * mode demands properties be initialized. class-validator populates these at
 * runtime via the ValidationPipe's `transform: true` option.
 */
export class StartAttemptDto {
  /** ID of the user starting the attempt. Passed manually (no auth in MVP). */
  @IsString()
  @IsNotEmpty()
  userId!: string;

  /** Unique exam code (e.g., "DEMO-001"). Used to look up the exam. */
  @IsString()
  @IsNotEmpty()
  examCode!: string;
}

/**
 * Response DTO returned after successfully starting an attempt.
 *
 * The frontend uses these fields to:
 * - Store `attemptId` for the subsequent submit call
 * - Display a countdown timer using `startedAt` and `endsAt`
 * - Calculate remaining time: endsAt - now
 */
export class StartAttemptResponseDto {
  /** Unique ID of the created attempt. Needed for POST /attempt/submit. */
  attemptId: string;
  /** Timestamp when the attempt was created (server time). */
  startedAt: Date;
  /** Timestamp when the exam expires. Calculated as: startedAt + durationMins. */
  endsAt: Date;

  constructor(partial: StartAttemptResponseDto) {
    this.attemptId = partial.attemptId;
    this.startedAt = partial.startedAt;
    this.endsAt = partial.endsAt;
  }
}
