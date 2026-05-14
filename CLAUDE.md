# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Warning: Non-Standard Versions

This project uses **Next.js 16**, **Vercel AI SDK v6**, and **Prisma 7** — all of which have breaking changes from earlier versions. Do not assume API compatibility with training data.

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build
npm run lint         # ESLint
npm test             # run all tests once (vitest run)

# Run a single test file
npx vitest run lib/__tests__/parse-lesson.test.ts

# Type check without building
npx tsc --noEmit

# Prisma
npx prisma generate          # regenerate client after schema changes
npx prisma db push           # push schema to database
npx prisma studio            # GUI for the database
```

## Environment

Required in `.env.local`:
```
DATABASE_URL=file:./teachme.db   # local SQLite file
ANTHROPIC_API_KEY=               # optional — for Claude via API
OPENAI_API_KEY=                  # optional — for GPT-4o
GEMINI_API_KEY=                  # optional — for Gemini
```

## Architecture

### No auth — personal-use only

There is no login, no Supabase, no user accounts. The app is a local tool for one user. All routes are open. There is no `middleware.ts`, no `lib/supabase.ts`, no `lib/crypto.ts`.

### SQLite via Prisma 7 + LibSQL adapter

`lib/db.ts` creates a `PrismaClient` using `PrismaLibSql` adapter. The DB file is `teachme.db` in the project root.

**Critical Prisma 7 quirk:** `new PrismaClient()` with no args throws. Must pass `{ adapter }`. The `DATABASE_URL` is defined in `prisma.config.ts` (not in `schema.prisma` — that's a Prisma 7 breaking change).

Models: `Lesson` (lesson records) and `Config` (key-value store for `activeProvider`).

### AI providers

`lib/ai/provider.ts` exports `getProviderModel()` and `getActiveProvider()`. Active provider is stored in the SQLite `Config` table (key: `activeProvider`). Keys come from env vars, not the DB.

Supported providers:
- `claude-code` — uses `claude -p` CLI subprocess via `lib/ai/claude-cli.ts` (no API key needed)
- `anthropic` — requires `ANTHROPIC_API_KEY`
- `openai` — requires `OPENAI_API_KEY`
- `gemini` — requires `GEMINI_API_KEY`

### Lesson generation flow

1. `POST /api/lessons` streams raw JSON text from the AI while accumulating the full response server-side.
2. After the stream completes, server parses + saves the lesson, then appends `__LESSON_ID__<id>__` sentinel.
3. `CreateForm` reads the stream until the sentinel, then navigates to `/lessons/<id>`.

Errors are sent as `__ERROR__<message>` sentinel.

### AI SDK v6 API

Key differences from older versions:
- Import `useChat` from `@ai-sdk/react`, not `ai/react`
- Chat API route returns `createUIMessageStreamResponse` (not `toDataStreamResponse`)
- `streamText` uses `maxOutputTokens` not `maxTokens`

### Lesson visual rendering

`SectionBlock` dispatches on `visual.type`:
- `mermaid` → `MermaidDiagram` (dynamic import, renders SVG client-side)
- `chart` → `ChartBlock` (Chart.js Bar/Line/Pie)
- `code` → `CodePlayground` (editable textarea + Piston API at `https://emkc.org/api/v2/piston/execute` for Python/Go/etc; Sandpack for JS/TS)

### URL/file extraction

`POST /api/extract-url` scrapes web pages or YouTube transcripts. `POST /api/extract-file` handles PDF/DOCX/TXT uploads. Both are called from `CreateForm` before sending to `/api/lessons`.
