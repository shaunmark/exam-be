/**
 * UploadService — Excel parsing, validation, and database population.
 *
 * Parses an Excel workbook buffer with two sheets:
 *   Sheet 1 ("Exams"):     Exam metadata rows
 *   Sheet 2 ("Questions"): Question rows linked to exams via examCode
 *
 * Validation rules:
 * - Required exam fields:     code, title, durationMins
 * - Required question fields: examCode, text, optionA, optionB, optionC, optionD, correctOption
 *
 * Defaults applied when fields are missing:
 * - Exam.description  → null
 * - Exam.isActive     → true
 * - Exam.totalMarks   → computed from sum of question marks
 * - Question.marks    → 1
 * - Question.order    → auto-incremented per exam (1, 2, 3, ...)
 *
 * All inserts happen inside a single Prisma transaction to ensure atomicity —
 * if any row fails validation or insertion, nothing is committed.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as ExcelJS from 'exceljs';

/** Shape of a parsed exam row before DB insertion. */
interface ParsedExam {
  code: string;
  title: string;
  description: string | null;
  durationMins: number;
  isActive: boolean;
}

/** Shape of a parsed question row before DB insertion. */
interface ParsedQuestion {
  examCode: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  order: number | null;
  marks: number;
}

@Injectable()
export class UploadService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Main entry point: parse the Excel buffer and populate the database.
   *
   * @param buffer - The raw .xlsx file buffer from Multer
   * @param conflictStrategy - How to handle duplicate exam codes ('error', 'skip', 'update')
   * @returns Summary of created exams and questions
   * @throws BadRequestException on validation errors
   */
  async parseAndPopulate(buffer: Buffer, conflictStrategy: 'error' | 'skip' | 'update' = 'error') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const examsSheet = workbook.getWorksheet('Exams') ?? workbook.getWorksheet(1);
    const questionsSheet = workbook.getWorksheet('Questions') ?? workbook.getWorksheet(2);

    if (!examsSheet) {
      throw new BadRequestException(
        'Missing "Exams" sheet. The workbook must have a sheet named "Exams" (or be the first sheet).',
      );
    }
    if (!questionsSheet) {
      throw new BadRequestException(
        'Missing "Questions" sheet. The workbook must have a second sheet named "Questions".',
      );
    }

    let exams = this.parseExamsSheet(examsSheet);
    const questions = this.parseQuestionsSheet(questionsSheet);

    // Check for existing exam codes in database before proceeding
    const examCodes = exams.map((e) => e.code);
    const existingConflicts = await this.checkForExistingExamCodes(examCodes);
    
    // Handle conflicts based on strategy
    if (existingConflicts.length > 0) {
      if (conflictStrategy === 'error') {
        throw new BadRequestException({
          message: 'Duplicate exam codes found in database',
          type: 'DATABASE_CONFLICTS',
          conflicts: existingConflicts,
          suggestion: 'Please remove these exam codes from your Excel file or use different codes',
        });
      }
      
      if (conflictStrategy === 'skip') {
        // Filter out exams that already exist
        const conflictCodes = new Set(existingConflicts.map(c => c.code));
        exams = exams.filter(exam => !conflictCodes.has(exam.code));
        
        if (exams.length === 0) {
          throw new BadRequestException({
            message: 'All exams already exist in database',
            type: 'ALL_DUPLICATES',
            conflicts: existingConflicts,
            suggestion: 'No new exams to import. All exam codes already exist.',
          });
        }
      }
      
      // For 'update' strategy, we'll proceed with all exams and update existing ones
      // (This would require additional implementation for update logic)
    }

    // Validate that every question references an exam that exists in the Exams sheet
    const examCodeSet = new Set(exams.map((e) => e.code));
    const orphanedQuestions = questions.filter((q) => !examCodeSet.has(q.examCode));
    if (orphanedQuestions.length > 0) {
      const orphanCodes = [...new Set(orphanedQuestions.map((q) => q.examCode))];
      throw new BadRequestException(
        `Questions reference exam codes not found in the Exams sheet: ${orphanCodes.join(', ')}`,
      );
    }

    // Group questions by examCode to compute totalMarks and auto-assign order
    const questionsByExam = new Map<string, ParsedQuestion[]>();
    for (const q of questions) {
      const list = questionsByExam.get(q.examCode) ?? [];
      list.push(q);
      questionsByExam.set(q.examCode, list);
    }

    // Auto-assign order for questions that don't have one
    for (const [, examQuestions] of questionsByExam) {
      let maxOrder = 0;
      for (const q of examQuestions) {
        if (q.order !== null && q.order > maxOrder) {
          maxOrder = q.order;
        }
      }
      for (const q of examQuestions) {
        if (q.order === null) {
          maxOrder++;
          q.order = maxOrder;
        }
      }
    }

    // Run everything in a single transaction for atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      const createdExams: { code: string; id: string; questionCount: number }[] = [];

      for (const exam of exams) {
        const examQuestions = questionsByExam.get(exam.code) ?? [];
        const totalMarks = examQuestions.reduce((sum, q) => sum + q.marks, 0);

        const created = await tx.exam.create({
          data: {
            code: exam.code,
            title: exam.title,
            description: exam.description,
            durationMins: exam.durationMins,
            totalMarks,
            isActive: exam.isActive,
          },
        });

        if (examQuestions.length > 0) {
          await tx.question.createMany({
            data: examQuestions.map((q) => ({
              examId: created.id,
              text: q.text,
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
              correctOption: q.correctOption,
              order: q.order as number,
              marks: q.marks,
            })),
          });
        }

        createdExams.push({
          code: created.code,
          id: created.id,
          questionCount: examQuestions.length,
        });
      }

      return createdExams;
    });

    return {
      message: conflictStrategy === 'skip' && existingConflicts.length > 0 
        ? 'Excel data imported with some exams skipped due to duplicates.'
        : 'Excel data imported successfully.',
      examsCreated: result.length,
      examsSkipped: conflictStrategy === 'skip' ? existingConflicts.length : 0,
      conflicts: conflictStrategy === 'skip' ? existingConflicts : undefined,
      details: result,
    };
  }

  /**
   * Parse the "Exams" sheet into validated ParsedExam objects.
   *
   * Expected columns (row 1 = header):
   *   code | title | description | durationMins | isActive
   */
  private parseExamsSheet(sheet: ExcelJS.Worksheet): ParsedExam[] {
    const headers = this.getHeaders(sheet);
    const errors: string[] = [];
    const exams: ParsedExam[] = [];
    const seenCodes = new Set<string>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header row

      const getValue = (col: string): string | undefined => {
        const idx = headers.indexOf(col.toLowerCase());
        if (idx === -1) return undefined;
        const cell = row.getCell(idx + 1);
        const val = cell.value;
        if (val === null || val === undefined) return undefined;
        return String(val).trim();
      };

      const code = getValue('code');
      const title = getValue('title');
      const durationMinsStr = getValue('durationmins');
      const description = getValue('description') ?? null;
      const isActiveStr = getValue('isactive');

      // Validate required fields
      const rowErrors: string[] = [];
      if (!code) rowErrors.push('code');
      if (!title) rowErrors.push('title');
      if (!durationMinsStr) rowErrors.push('durationMins');

      if (rowErrors.length > 0) {
        errors.push(`Row ${rowNumber}: missing required field(s): ${rowErrors.join(', ')}`);
        return;
      }

      const durationMins = parseInt(durationMinsStr!, 10);
      if (isNaN(durationMins) || durationMins <= 0) {
        errors.push(`Row ${rowNumber}: durationMins must be a positive integer, got "${durationMinsStr}"`);
        return;
      }

      if (seenCodes.has(code!)) {
        errors.push(`Row ${rowNumber}: duplicate exam code "${code}"`);
        return;
      }
      seenCodes.add(code!);

      // Default isActive to true; accept "false", "0", "no" as falsy
      let isActive = true;
      if (isActiveStr !== undefined) {
        const lower = isActiveStr.toLowerCase();
        isActive = !['false', '0', 'no'].includes(lower);
      }

      exams.push({
        code: code!,
        title: title!,
        description,
        durationMins,
        isActive,
      });
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation errors in Exams sheet',
        errors,
      });
    }

    if (exams.length === 0) {
      throw new BadRequestException('Exams sheet has no data rows (only a header or empty).');
    }

    return exams;
  }

  /**
   * Parse the "Questions" sheet into validated ParsedQuestion objects.
   *
   * Expected columns (row 1 = header):
   *   examCode | text | optionA | optionB | optionC | optionD | correctOption | order | marks
   */
  private parseQuestionsSheet(sheet: ExcelJS.Worksheet): ParsedQuestion[] {
    const headers = this.getHeaders(sheet);
    const errors: string[] = [];
    const questions: ParsedQuestion[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header row

      const getValue = (col: string): string | undefined => {
        const idx = headers.indexOf(col.toLowerCase());
        if (idx === -1) return undefined;
        const cell = row.getCell(idx + 1);
        const val = cell.value;
        if (val === null || val === undefined) return undefined;
        return String(val).trim();
      };

      const examCode = getValue('examcode');
      const text = getValue('text');
      const optionA = getValue('optiona');
      const optionB = getValue('optionb');
      const optionC = getValue('optionc');
      const optionD = getValue('optiond');
      const correctOptionRaw = getValue('correctoption');
      const orderStr = getValue('order');
      const marksStr = getValue('marks');

      // Validate required fields
      const rowErrors: string[] = [];
      if (!examCode) rowErrors.push('examCode');
      if (!text) rowErrors.push('text');
      if (!optionA) rowErrors.push('optionA');
      if (!optionB) rowErrors.push('optionB');
      if (!optionC) rowErrors.push('optionC');
      if (!optionD) rowErrors.push('optionD');
      if (!correctOptionRaw) rowErrors.push('correctOption');

      if (rowErrors.length > 0) {
        errors.push(`Row ${rowNumber}: missing required field(s): ${rowErrors.join(', ')}`);
        return;
      }

      // Validate correctOption is one of A, B, C, D
      const correctOption = correctOptionRaw!.toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
        errors.push(
          `Row ${rowNumber}: correctOption must be A, B, C, or D — got "${correctOptionRaw}"`,
        );
        return;
      }

      // Parse optional order (null means auto-assign later)
      let order: number | null = null;
      if (orderStr) {
        order = parseInt(orderStr, 10);
        if (isNaN(order) || order <= 0) {
          errors.push(`Row ${rowNumber}: order must be a positive integer, got "${orderStr}"`);
          return;
        }
      }

      // Parse optional marks (default 1)
      let marks = 1;
      if (marksStr) {
        marks = parseInt(marksStr, 10);
        if (isNaN(marks) || marks <= 0) {
          errors.push(`Row ${rowNumber}: marks must be a positive integer, got "${marksStr}"`);
          return;
        }
      }

      questions.push({
        examCode: examCode!,
        text: text!,
        optionA: optionA!,
        optionB: optionB!,
        optionC: optionC!,
        optionD: optionD!,
        correctOption,
        order,
        marks,
      });
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation errors in Questions sheet',
        errors,
      });
    }

    return questions;
  }

  /**
   * Check if any exam codes already exist in the database.
   * 
   * @param codes - Array of exam codes to check
   * @returns Array of conflict objects with existing exam details
   */
  private async checkForExistingExamCodes(codes: string[]): Promise<Array<{code: string, title: string}>> {
    const existingExams = await this.prisma.exam.findMany({
      where: { code: { in: codes } },
      select: { code: true, title: true }
    });
    return existingExams.map(exam => ({ code: exam.code, title: exam.title }));
  }

  /**
   * Extract lowercase header names from the first row of a worksheet.
   * Used for case-insensitive column matching.
   */
  private getHeaders(sheet: ExcelJS.Worksheet): string[] {
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim().toLowerCase();
    });
    return headers;
  }
}
