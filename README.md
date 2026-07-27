# CC-Quality — Call Center Quality Scoring System (QA Scorecard)

A configuration-driven web application for scoring call-center agent calls against a QA
rubric, auto-calculating every accuracy figure, and giving agents transparent feedback.

- **Product spec:** [`tasks/prd-qa-scorecard-system.md`](tasks/prd-qa-scorecard-system.md)
- **Engine / rubric / schema authority:** [`QA-Scorecard-System-Design.md`](QA-Scorecard-System-Design.md)
- **Build task list:** [`tasks/tasks-prd-qa-scorecard-system.md`](tasks/tasks-prd-qa-scorecard-system.md)

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Charts | Recharts (added in reporting tasks) |
| Testing | Jest + React Testing Library |
| Tooling | ESLint (`next`) + Prettier |

## Prerequisites

- **Node.js** 20+ and npm
- **PostgreSQL** running and reachable (default `localhost:5432`)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
#    Copy the template, then set DATABASE_URL to your local Postgres.
cp .env.example .env
#    Edit .env — never commit it (it is gitignored).

# 3. Create the database schema / verify the connection
npx prisma db push        # creates the DB if missing and syncs the schema
npx prisma generate       # regenerates the typed Prisma client

# 4. Run the app
npm run dev               # http://localhost:3000
```

## Available Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server (hot reload) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run format` / `npm run format:check` | Prettier write / check |
| `npm test` | Run the Jest test suite (configured in task 1.4) |

## Project Structure

```
CC-Quality/
├─ prisma/
│  └─ schema.prisma      # Datasource + Prisma models (domain models added in task 2.0)
├─ src/
│  ├─ app/               # Next.js App Router: routes, layouts, pages, API route handlers
│  ├─ components/        # Reusable React components (charts, forms, shared UI)
│  └─ lib/
│     ├─ config/         # Scorecard config: loader, guardrail validators, versioning
│     ├─ db/             # Prisma client singleton + repositories (data-access layer)
│     ├─ engine/         # Calculation engine: scoring modes, lenses, rank, analytics
│     └─ rbac/           # Roles, permission catalog, server-side authorization
├─ tests/                # Cross-cutting suites (e.g. the reconciliation harness)
├─ tasks/                # PRD + task list
└─ .env / .env.example   # Environment config (DATABASE_URL, secrets)
```

## Conventions

- **TypeScript strict mode** is on. Prefer explicit types at module boundaries.
- **Path alias:** import from `@/…` which maps to `src/…` (e.g. `import { prisma } from "@/lib/db/client"`).
- **Tests:** unit tests live **alongside** the file they test (`rank.ts` → `rank.test.ts`).
  Cross-cutting suites (reconciliation, integration) live under `tests/`.
- **Formatting/linting:** run `npm run format` and `npm run lint` before committing.
- **The Golden Rule (engine):** no domain value may be hardcoded in `src/lib/engine/**` —
  no section codes (`"CC"`, `"NC"`), benchmarks (`0.95`), or counts (`6`). Everything is read
  from config or derived. This is enforced by a guard test (task 5.8). Reconciliation targets
  (e.g. `92.89%`) may appear **only** in test assertions, never in engine logic.
- **Config is versioned & immutable:** editing the scorecard config creates a new version;
  historical evaluations stay pinned to the version they were scored under. Never recompute
  locked history.
- **Commits:** conventional-commit format (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`),
  one commit per completed parent task (see `.curser/rules/process-task-list.md`).

## Secrets

`.env` is gitignored and must never be committed. Only `.env.example` (with placeholder
values) is tracked. Rotate any credential that has been shared outside the file.
