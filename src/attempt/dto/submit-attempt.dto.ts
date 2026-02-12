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

export class AnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['A', 'B', 'C', 'D'])
  selectedOption!: string;

  @IsBoolean()
  @IsOptional()
  isMarkedForReview?: boolean;
}

export class SubmitAttemptDto {
  @IsString()
  @IsNotEmpty()
  attemptId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}

export class SubmitAttemptResponseDto {
  attemptId: string;
  score: number;
  totalMarks: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
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
