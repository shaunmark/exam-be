# Exam Platform Backend (MVP)

Production-ready MVP backend for an online exam-taking platform.

## Tech Stack

- **NestJS 11** — Framework
- **Prisma 7** — ORM
- **PostgreSQL (Neon)** — Database
- **TypeScript** — Strict mode enabled

## Project Structure

```
src/
├── prisma/              # Global Prisma module & service
│   ├── prisma.module.ts
│   ├── prisma.service.ts
│   └── index.ts
├── exam/                # Exam module (read-only)
│   ├── dto/
│   │   └── exam-response.dto.ts
│   ├── exam.controller.ts
│   ├── exam.service.ts
│   └── exam.module.ts
├── attempt/             # Attempt module (start + submit)
│   ├── dto/
│   │   ├── start-attempt.dto.ts
│   │   └── submit-attempt.dto.ts
│   ├── attempt.controller.ts
│   ├── attempt.service.ts
│   └── attempt.module.ts
├── app.module.ts
├── app.controller.ts
├── app.service.ts
└── main.ts
prisma/
├── schema.prisma
└── seed.ts
prisma.config.ts         # Prisma 7 migration config
```

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

### 3. Run database migration

```bash
npx prisma migrate dev --name init
```

### 4. Generate Prisma client

```bash
npx prisma generate
```

### 5. Seed the database

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

Server runs on `http://localhost:3000` by default.

## API Endpoints

### `GET /exam/:code`

Returns exam metadata + questions (without correct answers).

**Example:** `GET /exam/DEMO-001`

### `POST /attempt/start`

Starts an exam attempt.

```json
{
  "userId": "user-1",
  "examCode": "DEMO-001"
}
```

**Returns:** `attemptId`, `startedAt`, `endsAt`

### `POST /attempt/submit`

Submits answers for an attempt.

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

**Returns:** `attemptId`, `score`, `totalMarks`, `totalQuestions`, `answeredQuestions`, `correctAnswers`, `submittedAt`

## Key Design Decisions

### Schema Improvements

- **`@@unique([userId, examId])`** on `ExamAttempt` — Prevents duplicate attempts at the DB level (one attempt per user per exam)
- **`@@unique([examId, order])`** on `Question` — Guarantees question ordering integrity
- **`@@unique([attemptId, questionId])`** on `AttemptAnswer` — Prevents duplicate answers at the DB level
- **`isCorrect` stored on `AttemptAnswer`** — Avoids recomputation; score is deterministic at submission time
- **`TIMED_OUT` status** — Distinguishes clean submissions from expired attempts
- **`isActive` on Exam** — Soft-disable exams without deletion
- **`marks` per question** — Supports variable marks per question (defaults to 1)
- **Cascade deletes** — Cleaning up related data when parent is deleted

### Performance & Safety

- **No N+1 queries** — All questions fetched in a single query, scored via in-memory Map lookup
- **Batch insert** — `createMany` for answers instead of per-answer inserts
- **Prisma transaction** — Answers + attempt update are atomic; no partial state
- **Grace period** — 5-second tolerance on submission deadline for network latency
- **Duplicate answer dedup** — First answer per question wins; duplicates silently skipped
- **Friendly conflict errors** — Check before insert to avoid raw DB constraint errors
- **`select` projections** — Only fetch needed fields; `correctOption` never returned to client
- **Global ValidationPipe** — Whitelist + transform + forbidNonWhitelisted strips unknown fields

### Architecture

- **Global PrismaModule** — Single shared DB connection across all modules
- **Thin controllers** — All business logic in services
- **Response DTOs** — DB shape never leaked to client
- **Input DTOs** — class-validator decorators with strict typing
- **`selectedOption` validated** — Only A/B/C/D accepted via `@IsIn`