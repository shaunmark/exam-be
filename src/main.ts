/**
 * Application entry point.
 *
 * Bootstraps the NestJS application with:
 * - Global ValidationPipe for automatic DTO validation on all incoming requests
 * - CORS enabled for cross-origin frontend access (e.g., Next.js frontend)
 * - Configurable port via PORT env var (defaults to 3000)
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /**
   * Global validation pipe applied to ALL incoming requests.
   *
   * - whitelist: true        → Strips any properties NOT defined in the DTO.
   *                             Prevents clients from injecting unexpected fields.
   * - forbidNonWhitelisted   → Returns a 400 error if unknown properties are sent
   *                             (instead of silently stripping them).
   * - transform: true        → Automatically transforms plain JSON objects into
   *                             DTO class instances, enabling class-transformer
   *                             decorators like @Type() to work for nested validation.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /** Enable CORS so the frontend (running on a different origin) can call this API. */
  app.enableCors();

  /** Listen on PORT from env, or default to 3000. */
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0'); //for railway
}
void bootstrap();
