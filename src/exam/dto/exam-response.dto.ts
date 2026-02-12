export class QuestionOptionDto {
  id!: string;
  text!: string;
  optionA!: string;
  optionB!: string;
  optionC!: string;
  optionD!: string;
  order!: number;
  marks!: number;

  constructor(partial: QuestionOptionDto) {
    Object.assign(this, partial);
  }
}

export class ExamResponseDto {
  id!: string;
  code!: string;
  title!: string;
  description!: string | null;
  durationMins!: number;
  totalMarks!: number;
  totalQuestions!: number;
  questions!: QuestionOptionDto[];

  constructor(partial: ExamResponseDto) {
    Object.assign(this, partial);
  }
}
