import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ExamModule } from './exam/exam.module.js';
import { AttemptModule } from './attempt/attempt.module.js';

@Module({
  imports: [PrismaModule, ExamModule, AttemptModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
