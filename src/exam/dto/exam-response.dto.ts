/**
 * Response DTOs for the GET /exam/:code endpoint.
 *
 * These DTOs define the EXACT shape of data returned to the client.
 * They act as a contract between the backend and frontend.
 *
 * IMPORTANT: These are RESPONSE DTOs (outgoing), not input DTOs (incoming).
 * They do NOT have class-validator decorators because they are never validated —
 * they are constructed by the service and serialized to JSON automatically.
 *
 * The `!` (definite assignment assertion) on each property tells TypeScript
 * "this property WILL be assigned before use" — which is true because the
 * constructor uses Object.assign() to populate all fields from the partial.
 * This is required because TypeScript strict mode enforces that all properties
 * must be initialized in the constructor or have a default value.
 */

/**
 * Represents a single question as returned to the client.
 *
 * CRITICAL: This DTO intentionally EXCLUDES `correctOption`.
 * The correct answer is NEVER sent to the client in the exam endpoint.
 * It is only used server-side during score calculation in AttemptService.submitAttempt().
 */
export class QuestionOptionDto {
  id!: string;
  text!: string;
  optionA!: string;
  optionB!: string;
  optionC!: string;
  optionD!: string;
  /** Display order of the question (1-based). Questions are sorted by this field. */
  order!: number;
  /** Points awarded for a correct answer. Defaults to 1 in the DB schema. */
  marks!: number;

  /**
   * Constructor accepts a partial matching the DTO shape and assigns all properties.
   * Object.assign() is used for brevity — it copies all enumerable own properties.
   */
  constructor(partial: QuestionOptionDto) {
    Object.assign(this, partial);
  }
}

/**
 * Lightweight DTO for the GET /exam listing endpoint.
 *
 * Returns exam summary info for UI cards/lists — no questions included.
 * `totalQuestions` is included so the UI can show "X questions" without
 * fetching the full exam detail.
 */
export class ExamListItemDto {
  id!: string;
  code!: string;
  title!: string;
  description!: string | null;
  durationMins!: number;
  totalMarks!: number;
  totalQuestions!: number;
  createdAt!: Date;

  constructor(partial: ExamListItemDto) {
    Object.assign(this, partial);
  }
}

/**
 * DTO for exam meta information - lightweight summary with only essential fields.
 * Used for the GET /exam/:code/meta endpoint.
 */
export class ExamMetaDto {
  id!: string;
  code!: string;
  title!: string;
  description!: string | null;
  durationMins!: number;
  totalQuestions!: number;

  constructor(partial: ExamMetaDto) {
    Object.assign(this, partial);
  }
}

/**
 * Top-level response DTO for GET /exam/:code.
 *
 * Contains exam metadata + an array of questions (without correct answers).
 * `totalQuestions` is computed from the questions array length in the service,
 * NOT stored in the DB — this avoids data inconsistency if questions are added/removed.
 */
export class ExamResponseDto {
  id!: string;
  /** Unique exam code used in the URL (e.g., "DEMO-001"). */
  code!: string;
  title!: string;
  /** Optional description. Null if not set. */
  description!: string | null;
  /** Exam duration in minutes. Used by the frontend to show a countdown timer. */
  durationMins!: number;
  /** Sum of all question marks. Used to display "Score: X / totalMarks". */
  totalMarks!: number;
  /** Number of questions in this exam. Computed, not stored. */
  totalQuestions!: number;
  /** Ordered list of questions (sorted by `order` ASC). No correct answers included. */
  questions!: QuestionOptionDto[];

  constructor(partial: ExamResponseDto) {
    Object.assign(this, partial);
  }
}
