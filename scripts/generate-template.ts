/**
 * Generate a sample Excel template for the exam upload feature.
 *
 * Run with: npx ts-node scripts/generate-template.ts
 *
 * Creates: scripts/exam-template.xlsx
 * This file can be filled in and uploaded via POST /upload/excel.
 */
import * as ExcelJS from 'exceljs';
import path from 'node:path';

async function main() {
  const workbook = new ExcelJS.Workbook();

  // ── Sheet 1: Exams ──────────────────────────────────────────────────
  const examsSheet = workbook.addWorksheet('Exams');
  examsSheet.columns = [
    { header: 'code', key: 'code', width: 18 },
    { header: 'title', key: 'title', width: 40 },
    { header: 'description', key: 'description', width: 50 },
    { header: 'durationMins', key: 'durationMins', width: 15 },
    { header: 'isActive', key: 'isActive', width: 10 },
  ];

  // Style the header row
  examsSheet.getRow(1).font = { bold: true };
  examsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  examsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Sample data
  examsSheet.addRow({
    code: 'JS-101',
    title: 'JavaScript Basics Exam',
    description: 'Covers JavaScript fundamentals including variables, types, and functions.',
    durationMins: 30,
    isActive: true,
  });
  examsSheet.addRow({
    code: 'PY-201',
    title: 'Python Intermediate Exam',
    description: 'Covers Python OOP, decorators, and generators.',
    durationMins: 45,
    isActive: true,
  });

  // ── Sheet 2: Questions ──────────────────────────────────────────────
  const questionsSheet = workbook.addWorksheet('Questions');
  questionsSheet.columns = [
    { header: 'examCode', key: 'examCode', width: 18 },
    { header: 'text', key: 'text', width: 60 },
    { header: 'optionA', key: 'optionA', width: 25 },
    { header: 'optionB', key: 'optionB', width: 25 },
    { header: 'optionC', key: 'optionC', width: 25 },
    { header: 'optionD', key: 'optionD', width: 25 },
    { header: 'correctOption', key: 'correctOption', width: 15 },
    { header: 'order', key: 'order', width: 8 },
    { header: 'marks', key: 'marks', width: 8 },
  ];

  questionsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  questionsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF548235' },
  };

  // Sample questions for JS-101
  questionsSheet.addRow({
    examCode: 'JS-101',
    text: 'Which keyword declares a block-scoped variable?',
    optionA: 'var',
    optionB: 'let',
    optionC: 'const',
    optionD: 'static',
    correctOption: 'B',
    order: 1,
    marks: 1,
  });
  questionsSheet.addRow({
    examCode: 'JS-101',
    text: 'What does typeof null return?',
    optionA: '"null"',
    optionB: '"undefined"',
    optionC: '"boolean"',
    optionD: '"object"',
    correctOption: 'D',
    order: 2,
    marks: 1,
  });

  // Sample questions for PY-201
  questionsSheet.addRow({
    examCode: 'PY-201',
    text: 'Which keyword is used to define a class in Python?',
    optionA: 'struct',
    optionB: 'class',
    optionC: 'def',
    optionD: 'type',
    correctOption: 'B',
    order: 1,
    marks: 2,
  });
  questionsSheet.addRow({
    examCode: 'PY-201',
    text: 'What does the @staticmethod decorator do?',
    optionA: 'Makes the method private',
    optionB: 'Makes the method async',
    optionC: 'Binds the method to the class, not an instance',
    optionD: 'Makes the method immutable',
    correctOption: 'C',
    order: 2,
    marks: 2,
  });

  const outPath = path.join(__dirname, 'exam-template.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log(`Template created: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
