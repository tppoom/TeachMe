# TeachMe

Generate complete, structured courses on any topic — with diagrams, runnable code playgrounds, and a context-aware AI tutor — powered by your own AI provider.

## Features

- **AI-generated courses** — multi-chapter lessons with objectives, examples, exercises, and key points
- **Five-stage pipeline** — Intake → Atlas → Syllabus → Author → Verify produces a thorough curriculum, not just a summary
- **Mermaid diagrams** — auto-generated when a concept is spatial or relational
- **Context-aware AI tutor** — chat panel knows the entire course and which chapter you're reading
- **Course editor** — edit any chapter, apply changes across the whole course, attach reference files
- **Import / Export** — share courses as `.teachme` files
- **Multiple AI providers** — use a local CLI (no API key) or a remote API key
- **Fully local** — SQLite database, no cloud account needed

---

## Requirements

- **Node.js 18+**
- One of the AI providers below (only one needed)

---

## Quick Start

```bash
git clone https://github.com/tppoom/teachme.git
cd teachme
npm install
cp .env.local.example .env.local
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), go to **Settings**, and configure an AI provider. You cannot generate courses until a provider is set up.

---

## AI Provider Setup

TeachMe supports six providers. **You only need one.** Local CLI providers are free (no API key needed) and the easiest way to get started.

### Option A — Local CLI (recommended, free, no API key)

#### Gemini CLI ⭐ Recommended default

Free with a Google account.

```bash
npm install -g @google/gemini-cli
gemini          # first run: opens browser for Google login
gemini --version
```

Docs: https://github.com/google-gemini/gemini-cli

---

#### Claude Code CLI

Requires an Anthropic account (free tier available).

```bash
npm install -g @anthropic-ai/claude-code
claude          # first run: opens browser for Anthropic login
claude --version
```

Docs: https://docs.anthropic.com/en/docs/claude-code

---

#### Codex CLI

Requires an OpenAI account.

```bash
npm install -g @openai/codex
codex           # first run: opens browser for OpenAI login
codex --version
```

Docs: https://github.com/openai/codex

---

### Option B — Remote API (API key required)

Get your key from the provider dashboard, then enter it in **Settings → AI Provider**.

| Provider | Key format | Get key |
|---|---|---|
| Anthropic (Claude) | `sk-ant-…` | https://console.anthropic.com |
| OpenAI (GPT-4o) | `sk-…` | https://platform.openai.com/api-keys |
| Google (Gemini) | `AIza…` | https://aistudio.google.com/app/apikey |

Keys are stored **encrypted (AES-256-GCM)** in the local SQLite database and never sent anywhere except directly to the provider API.

---

## Settings Page

The **Settings** page (top nav → Settings) shows:

- Which local CLIs are installed on your machine (green "Installed" / yellow "Not installed")
- A "How to install" guide for any CLI that is missing
- Whether API keys are saved for each remote provider
- A warning banner if no usable provider is selected

You can only select a provider that is ready to use. API providers require a key before they can be selected.

---

## Environment Variables

Copy `.env.local.example` to `.env.local`:

```env
# SQLite database path (default: project root)
DATABASE_URL=file:./teachme.db

# Optional — API keys can also be entered in the Settings UI
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

All variables are optional if you use a local CLI provider.

---

## Database

TeachMe uses **SQLite via Prisma 7 + LibSQL adapter**. No external database needed.

```bash
# Initialize (run once after cloning)
npx prisma generate
npx prisma db push

# Browse the database
npx prisma studio
```

The database file (`teachme.db`) is created automatically on first run and is excluded from git.

---

## Development

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build
npm run lint     # ESLint
npm test         # Vitest
npx tsc --noEmit # type check
```

---

## Project Structure

```
teachme/
├── app/
│   ├── (app)/
│   │   ├── create/        — course creation form
│   │   ├── dashboard/     — course library
│   │   ├── lessons/[id]/  — course viewer
│   │   └── settings/      — AI provider configuration
│   └── api/
│       ├── lessons/       — CRUD + streaming generation
│       ├── chat/          — AI tutor endpoint
│       ├── settings/      — provider config + API keys
│       └── extract-*/     — URL scraping + file parsing
├── components/
│   ├── lesson/            — viewer, section blocks, visuals, edit panel
│   ├── tutor/             — chat UI
│   └── create/            — creation form
├── lib/
│   ├── ai/
│   │   ├── pipeline.ts    — 5-stage generation pipeline
│   │   ├── provider.ts    — unified AI provider abstraction
│   │   ├── *-cli.ts       — CLI subprocess wrappers
│   │   └── generate-chat.ts — tutor prompt builder
│   └── db.ts              — Prisma client singleton
├── types/lesson.ts        — shared TypeScript types
└── prisma/schema.prisma
```

---

## How the Generation Pipeline Works

Generating a course goes through five sequential AI stages:

1. **Intake** — classifies the topic (programming / technical / conceptual / mixed) and infers learning goals
2. **Atlas** — builds a dependency graph of every concept the course must teach
3. **Syllabus** — clusters atlas nodes into chapters, assigns teaching formats per subtopic (code example, analogy, comparison table, step-by-step, etc.)
4. **Author** — writes each chapter following the syllabus contract
5. **Verify** — checks content quality and flags gaps

Each stage sees the output of the previous one, producing a coherent course rather than isolated summaries.

---

## Importing & Exporting Courses

**Export** — click the Export button in the top nav bar (visible on any lesson page) or the download icon on a course card on the dashboard. Saves a `<title>.teachme` file (plain JSON).

**Import** — click the Import button on the dashboard and select a `.teachme` file. The course is saved locally and opens immediately.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (Prisma 7 + LibSQL adapter) |
| AI SDK | Vercel AI SDK v6 |
| Diagrams | Mermaid.js |
| Charts | Chart.js / react-chartjs-2 |
| Code playgrounds | Sandpack (JS/TS), Piston API (other languages) |
| File parsing | pdf-parse, mammoth (DOCX), youtube-transcript |

---

## License

MIT
