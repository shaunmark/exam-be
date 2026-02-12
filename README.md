# Exam Platform Backend (MVP)

Production-ready MVP backend for an online exam-taking platform built with clean architecture principles.

## Business Constraints

- **Single-choice questions only** — Exactly 4 options (A/B/C/D), one correct answer per question
- **Strictly timed exams** — Cannot be paused; `endsAt` is calculated at start
- **One attempt per user per exam** — Enforced at both application and database level
- **One submission per attempt** — Only `IN_PROGRESS` attempts can be submitted
- **Answers saved only at submission** — No intermediate saves
- **No negative marking** — Score is sum of correct answer marks only
- **No authentication** — `userId` is passed manually in request body
- **No sections, analytics, or match-the-following**

## Tech Stack

- **NestJS 11** — Framework
- **Prisma 7** — ORM with `@prisma/adapter-neon` for serverless PostgreSQL
- **PostgreSQL (Neon)** — Database
- **TypeScript** — Strict mode enabled (`"strict": true` in tsconfig)
- **class-validator / class-transformer** — Request validation and DTO transformation
- **dotenv** — Environment variable loading for `prisma.config.ts`

## Project Structure

```
src/
├── prisma/                          # Global Prisma module & service
│   ├── prisma.module.ts             # @Global() module — available to all modules
│   ├── prisma.service.ts            # Extends PrismaClient with Neon adapter
│   └── index.ts                     # Barrel exports
├── exam/                            # Exam module (read-only)
│   ├── dto/
│   │   └── exam-response.dto.ts     # ExamResponseDto, QuestionOptionDto
│   ├── exam.controller.ts           # GET /exam/:code
│   ├── exam.service.ts              # Fetches exam + questions, maps to DTO
│   └── exam.module.ts
├── attempt/                         # Attempt module (start + submit)
│   ├── dto/
│   │   ├── start-attempt.dto.ts     # StartAttemptDto, StartAttemptResponseDto
│   │   └── submit-attempt.dto.ts    # SubmitAttemptDto, AnswerDto, SubmitAttemptResponseDto
│   ├── attempt.controller.ts        # POST /attempt/start, POST /attempt/submit
│   ├── attempt.service.ts           # Core business logic: start, score, submit
│   └── attempt.module.ts
├── upload/                          # Excel upload module
│   ├── upload.controller.ts         # POST /upload/excel
│   ├── upload.service.ts            # Excel parsing, validation, DB population
│   └── upload.module.ts
├── app.module.ts                    # Root module wiring Prisma, Exam, Attempt, Upload
├── app.controller.ts                # Health check (GET /)
├── app.service.ts
└── main.ts                          # Bootstrap: ValidationPipe, CORS, port
prisma/
├── schema.prisma                    # 4 models: Exam, Question, ExamAttempt, AttemptAnswer
└── seed.ts                          # Seeds 1 exam + 3 questions
prisma.config.ts                     # Prisma 7 config: loads .env, provides datasource URL
.env.example                         # Template for DATABASE_URL
scripts/
└── generate-template.ts             # Generates a sample exam-template.xlsx
```

## Database Schema

### Models

- **Exam** — `id`, `code` (unique), `title`, `description?`, `durationMins`, `totalMarks`, `isActive`, `createdAt`, `updatedAt`
- **Question** — `id`, `examId`, `text`, `optionA`–`optionD`, `correctOption` (A/B/C/D), `order`, `marks` (default 1)
- **ExamAttempt** — `id`, `userId`, `examId`, `status` (IN_PROGRESS/SUBMITTED/TIMED_OUT), `score?`, `startedAt`, `endsAt`, `submittedAt?`
- **AttemptAnswer** — `id`, `attemptId`, `questionId`, `selectedOption`, `isMarkedForReview`, `isCorrect`

### Key Indexes & Constraints

| Constraint | Table | Purpose |
|---|---|---|
| `@@unique([userId, examId])` | ExamAttempt | One attempt per user per exam |
| `@@unique([examId, order])` | Question | No duplicate question ordering |
| `@@unique([attemptId, questionId])` | AttemptAnswer | No duplicate answers per question |
| `@@index([code])` | Exam | Fast lookup by exam code |
| `@@index([examId])` | Question | Fast question fetch per exam |
| `@@index([userId, examId])` | ExamAttempt | Fast attempt lookup |
| `@@index([status])` | ExamAttempt | Filter by attempt status |
| `@@index([attemptId])` | AttemptAnswer | Fast answer fetch per attempt |
| `onDelete: Cascade` | All relations | Automatic cleanup of child records |

## Setup Instructions

### 1. Install dependencies

```bash
yarn install
```

### 2. Configure environment

Copy `.env.example` to `.env` and set your Neon PostgreSQL connection string:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"
```

### 3. Generate Prisma client

```bash
npx prisma generate
```

### 4. Run database migration

```bash
npx prisma migrate dev --name init
```

### 5. Seed the database

Creates 1 exam (`DEMO-001`) with 3 JavaScript questions.

```bash
npx prisma db seed
```

### 6. Start the server

```bash
# Development (watch mode)
yarn start:dev

# Production
yarn build
yarn start:prod
```

Server runs on `http://localhost:3000` by default. Port is configurable via `PORT` env var.

## API Endpoints

### `GET /exam`

Returns all active exams as lightweight summaries (no questions). Sorted by creation date (newest first). Used by the frontend for the exam listing/selection page.

**Example:** `GET /exam`

**Response:**

```json
[
  {
    "id": "clx...",
    "code": "DEMO-001",
    "title": "Demo JavaScript Fundamentals Exam",
    "description": "A short demo exam...",
    "durationMins": 30,
    "totalMarks": 3,
    "totalQuestions": 3,
    "createdAt": "2026-02-13T00:00:00.000Z"
  }
]
```

---

### `GET /exam/:code`

Returns exam metadata + questions ordered by `order` field. **Never returns `correctOption`.**

**Example:** `GET /exam/DEMO-001`

**Response:**

```json
{
  "id": "clx...",
  "code": "DEMO-001",
  "title": "Demo JavaScript Fundamentals Exam",
  "description": "A short demo exam...",
  "durationMins": 30,
  "totalMarks": 3,
  "totalQuestions": 3,
  "questions": [
    {
      "id": "clx...",
      "text": "Which keyword is used to declare a constant in JavaScript?",
      "optionA": "var",
      "optionB": "let",
      "optionC": "const",
      "optionD": "static",
      "order": 1,
      "marks": 1
    }
  ]
}
```

**Errors:**
- `404` — Exam not found or inactive

---

### `POST /attempt/start`

Creates a new exam attempt. Calculates `endsAt = now + durationMins`.

**Request:**

```json
{
  "userId": "user-1",
  "examCode": "DEMO-001"
}
```

**Response:**

```json
{
  "attemptId": "clx...",
  "startedAt": "2026-02-13T00:00:00.000Z",
  "endsAt": "2026-02-13T00:30:00.000Z"
}
```

**Errors:**
- `404` — Exam not found or inactive
- `409` — User already has an active or completed attempt for this exam

---

### `POST /attempt/submit`

Submits answers, calculates score, and persists everything atomically.

**Request:**

```json
{
  "attemptId": "<attemptId>",
  "answers": [
    { "questionId": "<id>", "selectedOption": "C" },
    { "questionId": "<id>", "selectedOption": "D", "isMarkedForReview": true },
    { "questionId": "<id>", "selectedOption": "B" }
  ]
}
```

- `selectedOption` must be one of `A`, `B`, `C`, `D`
- `isMarkedForReview` is optional (defaults to `false`)
- Partial submissions are allowed (not all questions need answers)
- Duplicate `questionId` entries are deduplicated (first one wins)

**Response:**

```json
{
  "attemptId": "clx...",
  "score": 2,
  "totalMarks": 3,
  "totalQuestions": 3,
  "answeredQuestions": 3,
  "correctAnswers": 2,
  "submittedAt": "2026-02-13T00:15:00.000Z"
}
```

**Errors:**
- `404` — Attempt not found
- `409` — Attempt already submitted
- `400` — Time expired (auto-marked as `TIMED_OUT`), or question doesn't belong to exam

### `POST /upload/excel`

Uploads an Excel (`.xlsx`) workbook to bulk-import exams and questions into the database.

Send as **multipart/form-data** with a single file field named `file` (max 10 MB).

The workbook must contain **two sheets**:

**Sheet 1 — "Exams"** (header row + data rows):

| Column | Required | Default |
|---|---|---|
| `code` | Yes | — |
| `title` | Yes | — |
| `description` | No | `null` |
| `durationMins` | Yes | — |
| `isActive` | No | `true` |

**Sheet 2 — "Questions"** (header row + data rows):

| Column | Required | Default |
|---|---|---|
| `examCode` | Yes | — |
| `text` | Yes | — |
| `optionA` | Yes | — |
| `optionB` | Yes | — |
| `optionC` | Yes | — |
| `optionD` | Yes | — |
| `correctOption` | Yes (A/B/C/D) | — |
| `order` | No | Auto-incremented per exam |
| `marks` | No | `1` |

- `totalMarks` on each exam is **auto-computed** from the sum of its question marks.
- All inserts are wrapped in a **single transaction** — if any row fails, nothing is committed.

**Example (curl):**

```bash
curl -X POST http://localhost:3000/upload/excel -F "file=@scripts/exam-template.xlsx"
```

**Response:**

```json
{
  "message": "Excel data imported successfully.",
  "examsCreated": 2,
  "details": [
    { "code": "JS-101", "id": "clx...", "questionCount": 2 },
    { "code": "PY-201", "id": "clx...", "questionCount": 2 }
  ]
}
```

**Errors:**
- `400` — No file uploaded, wrong file type, missing/invalid required fields, orphaned questions, or duplicate exam codes

**Generating a sample template:**

```bash
npx ts-node scripts/generate-template.ts
```

This creates `scripts/exam-template.xlsx` pre-filled with sample data you can modify and upload.

---

## Key Design Decisions

### Schema Improvements Over Naive Approach

- **`isCorrect` stored on `AttemptAnswer`** — Score is computed once at submission and persisted. No need to re-join questions to recalculate. Deterministic and auditable.
- **`TIMED_OUT` enum value** — Distinguishes clean submissions from expired attempts. Submissions within a 5-second grace period are accepted but marked `TIMED_OUT` if past deadline.
- **`isActive` on Exam** — Soft-disable exams without deletion. The `GET /exam/:code` and `POST /attempt/start` endpoints both filter by `isActive: true`.
- **`marks` per question** — Supports variable marks per question (defaults to 1) without schema changes later.
- **Cascade deletes** — All child records are cleaned up automatically when a parent is deleted.

### Performance & Safety

- **No N+1 queries** — All questions fetched in a single `findMany`, then scored via an in-memory `Map` for O(1) lookup per answer.
- **Batch insert** — `createMany` inserts all answers in one DB call instead of looping.
- **Prisma `$transaction`** — Answer insertion + attempt status update are atomic. If either fails, neither is persisted. No partial state.
- **5-second grace period** — Submissions arriving slightly after `endsAt` (due to network latency) are still accepted but marked `TIMED_OUT`.
- **Duplicate answer dedup** — If the client sends two answers for the same question, the first one wins. No DB constraint error.
- **Friendly conflict errors** — The service checks for existing attempts before `create` to return a clear `409 Conflict` instead of a raw Prisma unique constraint error.
- **`select` projections** — Every Prisma query uses `select` to fetch only needed fields. `correctOption` is **never** returned to the client in the exam endpoint.
- **Global `ValidationPipe`** — Configured with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`. Unknown fields are stripped, invalid payloads are rejected with clear error messages.

### Architecture

- **Global `PrismaModule`** — Decorated with `@Global()` so all modules share a single DB connection without re-importing.
- **`PrismaService` extends `PrismaClient`** — Uses `@prisma/adapter-neon` (`PrismaNeon`) for serverless-compatible connections to Neon PostgreSQL. Implements `OnModuleInit`/`OnModuleDestroy` for proper connection lifecycle.
- **Thin controllers** — Controllers only handle HTTP concerns (decorators, param extraction). All business logic lives in services.
- **Response DTOs** — Database model shape is never leaked to the client. Every response is mapped through a typed DTO class.
- **Input DTOs with `class-validator`** — All request bodies are validated with decorators (`@IsString`, `@IsNotEmpty`, `@IsIn`, `@ValidateNested`, `@ArrayMinSize`, etc.). No `any` types.
- **CORS enabled** — `app.enableCors()` in `main.ts` for Next.js frontend integration.
- **`prisma.config.ts`** — Prisma 7 requires a config file for migrations. Uses `dotenv` to explicitly load `.env` since Prisma 7 does not auto-load it.

### Seed Data

The seed script (`prisma/seed.ts`) creates:

- **1 exam** — Code: `DEMO-001`, Duration: 30 mins, 3 total marks
- **3 questions** — JavaScript fundamentals (const keyword, typeof null, Array.map)
- Correct answers: Q1=C, Q2=D, Q3=B