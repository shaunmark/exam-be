import { Module } from '@nestjs/common';
import { AttemptController } from './attempt.controller.js';
import { AttemptService } from './attempt.service.js';

@Module({
  controllers: [AttemptController],
  providers: [AttemptService],
})
export class AttemptModule {}
