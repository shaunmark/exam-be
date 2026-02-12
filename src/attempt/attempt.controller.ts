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

  @Post('start')
  async start(
    @Body() dto: StartAttemptDto,
  ): Promise<StartAttemptResponseDto> {
    return this.attemptService.startAttempt(dto);
  }

  @Post('submit')
  async submit(
    @Body() dto: SubmitAttemptDto,
  ): Promise<SubmitAttemptResponseDto> {
    return this.attemptService.submitAttempt(dto);
  }
}
