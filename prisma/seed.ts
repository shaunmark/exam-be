/**
 * Database Seed Script
 *
 * Run with: npx prisma db seed
 * (Configured in package.json under "prisma.seed")
 *
 * This script populates the database with initial test data:
 * - 1 exam (DEMO-001) with 30 minutes duration
 * - 3 JavaScript fundamentals questions (1 mark each)
 *
 * The script is IDEMPOTENT — it deletes all existing data before inserting.
 * This means you can run it multiple times safely without duplicating data.
 *
 * NOTE: This script uses the PrismaNeon adapter (same as the NestJS app)
 * because Prisma 7 requires an adapter for Neon serverless PostgreSQL.
 * The DATABASE_URL is loaded from .env by the Prisma CLI.
 *
 * IMPORTANT: This file is EXCLUDED from the NestJS build (see tsconfig.build.json)
 * because it's a standalone script, not part of the NestJS application.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

/**
 * Create a standalone PrismaClient instance for seeding.
 * This is separate from the NestJS PrismaService — it runs outside the app context.
 * The Neon adapter is required for connecting to Neon serverless PostgreSQL.
 */
const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  /**
   * Step 1: Clean existing data.
   *
   * Delete in reverse dependency order to avoid foreign key constraint violations:
   * 1. AttemptAnswer (depends on ExamAttempt and Question)
   * 2. ExamAttempt   (depends on Exam)
   * 3. Question      (depends on Exam)
   * 4. Exam          (no dependencies)
   *
   * This makes the seed script idempotent — safe to run repeatedly.
   */
  await prisma.attemptAnswer.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.exam.deleteMany();

  /**
   * Step 2: Create the demo exam.
   *
   * - code: "DEMO-001" — used in the URL: GET /exam/DEMO-001
   * - durationMins: 30 — students get 30 minutes to complete
   * - totalMarks: 3 — must match the sum of all question marks (3 × 1 = 3)
   * - isActive: true — exam is available for students to take
   */
  const exam = await prisma.exam.create({
    data: {
      code: 'DEMO-001',
      title: 'Demo JavaScript Fundamentals Exam',
      description:
        'A short demo exam to test your JavaScript fundamentals knowledge.',
      durationMins: 30,
      totalMarks: 3,
      isActive: true,
    },
  });

  /**
   * Step 3: Create questions using createMany() for batch insert efficiency.
   *
   * Each question has:
   * - Exactly 4 options (A/B/C/D) — enforced by the schema
   * - One correct answer (correctOption) — "A", "B", "C", or "D"
   * - An order field for display sorting (1-based)
   * - 1 mark each (default, but explicit here for clarity)
   *
   * Correct answers for testing:
   * - Q1: C (const)
   * - Q2: D ("object" — a famous JavaScript quirk)
   * - Q3: B (map)
   *
   * A perfect score would be 3/3.
   */
  await prisma.question.createMany({
    data: [
      {
        examId: exam.id,
        text: 'Which keyword is used to declare a constant in JavaScript?',
        optionA: 'var',
        optionB: 'let',
        optionC: 'const',
        optionD: 'static',
        correctOption: 'C',
        order: 1,
        marks: 1,
      },
      {
        examId: exam.id,
        text: 'What does typeof null return in JavaScript?',
        optionA: '"null"',
        optionB: '"undefined"',
        optionC: '"boolean"',
        optionD: '"object"',
        correctOption: 'D',
        order: 2,
        marks: 1,
      },
      {
        examId: exam.id,
        text: 'Which array method creates a new array with the results of calling a function on every element?',
        optionA: 'forEach',
        optionB: 'map',
        optionC: 'filter',
        optionD: 'reduce',
        correctOption: 'B',
        order: 3,
        marks: 1,
      },
    ],
  });

  console.log('Seed completed successfully.');
  console.log(`  Exam: ${exam.title} (code: ${exam.code})`);
  console.log(`  Questions: 3`);
}

/**
 * Execute the seed function.
 *
 * - .catch(): Log the error and exit with code 1 (failure) so CI/CD pipelines detect it.
 * - .finally(): Always disconnect from the database, even if seeding fails.
 *   `void` is used because $disconnect() returns a Promise but we don't need to await it
 *   in the finally block (the process is about to exit anyway).
 */
main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
