/**
 * AttemptController — HTTP layer for exam attempt lifecycle.
 *
 * This controller is intentionally THIN. It only:
 * 1. Receives the validated request body (via @Body() + global ValidationPipe)
 * 2. Delegates to AttemptService for all business logic
 * 3. Returns the response DTO (NestJS serializes it to JSON)
 *
 * No business logic, no scoring, no DB access — all of that lives in AttemptService.
 *
 * Route prefix: /attempt
 * Endpoints:
 * - POST /attempt/start  → Start a new exam attempt
 * - POST /attempt/submit → Submit answers and get score
 */
import { Body, Controller, Post } from '@nestjs/common';
import { AttemptService } from './attempt.service.js';
import {
  StartAttemptDto,
  StartAttemptResponseDto,
} from './dto/start-attempt.dto.js';
import {
  SubmitAttemptDto,
  SubmitAttemptResponseDto,
} from './dto/submit-attempt.dto.js';

@Controller('attempt')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  /**
   * POST /attempt/start
   *
   * Starts a new exam attempt for a user.
   * The request body is automatically validated by the global ValidationPipe
   * using the decorators defined in StartAttemptDto.
   *
   * @Body() dto — NestJS extracts the JSON body and transforms it into a StartAttemptDto.
   *               If validation fails, a 400 error is returned before this method runs.
   */
  @Post('start')
  async start(
    @Body() dto: StartAttemptDto,
  ): Promise<StartAttemptResponseDto> {
    return this.attemptService.startAttempt(dto);
  }

  /**
   * POST /attempt/submit
   *
   * Submits answers for an existing attempt and returns the score.
   * The answers array is validated including nested AnswerDto objects
   * (thanks to @ValidateNested + @Type decorators in SubmitAttemptDto).
   */
  @Post('submit')
  async submit(
    @Body() dto: SubmitAttemptDto,
  ): Promise<SubmitAttemptResponseDto> {
    return this.attemptService.submitAttempt(dto);
  }
}
