import { IsNotEmpty, IsString } from 'class-validator';

export class StartAttemptDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  examCode!: string;
}

export class StartAttemptResponseDto {
  attemptId: string;
  startedAt: Date;
  endsAt: Date;

  constructor(partial: StartAttemptResponseDto) {
    this.attemptId = partial.attemptId;
    this.startedAt = partial.startedAt;
    this.endsAt = partial.endsAt;
  }
}
