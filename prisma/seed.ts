import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing data
  await prisma.attemptAnswer.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.exam.deleteMany();

  // Create exam
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

  // Create questions with exactly 4 options each, single correct answer
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

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
