# ShipFlow AI

> AI-assisted product delivery platform — moves a feature from idea to production through a structured workflow:
>
> **Feature Request → PRD → Tasks → Code → AI Review → Fixes → Re-Review → Human Approval → Ship**

A multi-tenant SaaS where a customer/product-owner request is understood, clarified, turned into a structured PRD, broken into engineering tasks on a Kanban board, connected to a GitHub repository, reviewed by an AI QA/engineering reviewer against the requirements, sent back for fixes, re-reviewed until clean, and finally approved by a human before being marked shipped.

> **Status:** Active build. **M1 (monorepo foundation) is complete and verified.** Later milestones (auth, PRD, tasks, GitHub, AI review, approval, billing) are in progress — see [docs/PLAN.md](docs/PLAN.md). Sections below marked _(planned: Mx)_ are scaffolded but not yet implemented.

---

## Tech stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Web app | Next.js 16 (App Router, Turbopack, React 19) |
| API | tRPC v11 (type-safe, end-to-end) |
| Data | PostgreSQL + Prisma |
| Auth | BetterAuth _(planned: M2)_ |
| UI | shadcn/ui + Tailwind CSS v4 |
| AI | Vercel AI SDK + Claude (`claude-opus-4-8`) _(planned: M3+)_ |
| Async workflows | Inngest _(planned: M3+)_ |
| GitHub | Octokit (GitHub App + webhooks) _(planned: M5)_ |
| Billing | Razorpay _(planned: M8)_ |
| Deploy | Vercel |

> **Note on Next.js:** this project uses a build of Next.js 16 with breaking changes from older App Router knowledge. Key differences in play here: middleware is now `proxy.ts` (Node.js runtime), `cookies()`/`headers()`/`params` are async, Turbopack is the default builder (no custom webpack — Prisma is externalized via `serverExternalPackages`), and `fetch`/route handlers are not cached by default. Always check `node_modules/next/dist/docs/` before changing framework-level code.

---

## Architecture

A tRPC monorepo: one Next.js app consumes typed routers and shared packages.

```
shipflow-ai/
├─ apps/
│  └─ web/                    # @shipflow/web — Next.js app (UI + route handlers)
│     └─ src/
│        ├─ app/
│        │  ├─ api/trpc/[trpc]/route.ts   # tRPC fetch adapter
│        │  ├─ layout.tsx                 # wraps children in tRPC/React Query provider
│        │  └─ page.tsx                   # health-check landing (M1)
│        ├─ trpc/
│        │  ├─ client.tsx                 # 'use client' provider + useTRPC hook
│        │  └─ server.ts                  # server-side caller (RSC, no HTTP)
│        └─ proxy.ts                      # auth gate (Next 16 middleware)
├─ packages/
│  ├─ db/         # @shipflow/db — Prisma schema + client singleton
│  ├─ api/        # @shipflow/api — tRPC root router, context, procedures
│  ├─ auth/       # @shipflow/auth — BetterAuth config (stub today, M2)
│  ├─ ui/         # @shipflow/ui — shared components + cn() util
│  └─ tsconfig/   # @shipflow/tsconfig — shared TS base configs
├─ docs/          # PLAN.md (roadmap), COMMANDS.md (cheat-sheet)
├─ turbo.json     # task pipeline
└─ pnpm-workspace.yaml
```

**Type-safety spine:** `packages/api` exports the `AppRouter` type; `apps/web` imports it for a fully-typed client. `packages/db` generates Prisma types consumed everywhere. tRPC data is fetched two ways: a **server caller** (`trpc/server.ts`) for React Server Components (in-process, no HTTP) and a **client provider** (`trpc/client.tsx`) using TanStack Query for client components.

**Multi-tenancy:** every tenant-scoped table carries `organizationId`; tRPC's `orgProcedure` surfaces the active org so queries are always tenant-scoped. Routing is path-based (`/[orgSlug]/…`).

---

## Prerequisites

- **Node.js ≥ 20.9** (project tested on 22.x)
- **pnpm 11** — `corepack enable pnpm` or `npm i -g pnpm`
- **PostgreSQL** — local or hosted (Neon/Supabase/Railway)

---

## Setup

```bash
# 1. Install dependencies (from repo root)
pnpm install

# 2. Configure environment
cp .env.example .env        # then edit .env with your real values

# 3. Generate the Prisma client
pnpm db:generate

# 4. Create the database tables
pnpm db:push                # or `pnpm db:migrate` for migration history

# 5. Run the dev server
pnpm dev
```

Open **http://localhost:3000** — the landing page shows a live **server tRPC** and **client tRPC** health check (both green when the API is wired correctly). The DB health check at `/api/trpc/health.db` turns green once `DATABASE_URL` is set and `db:push` has run.

---

## Commands

Run from the repo root. See [docs/COMMANDS.md](docs/COMMANDS.md) for the full cheat-sheet including running a **specific app or package**.

| Command | What it does |
|---|---|
| `pnpm dev` | Run all apps in dev (Turborepo) |
| `pnpm build` | Production build of the whole monorepo |
| `pnpm typecheck` | Typecheck every package |
| `pnpm lint` | Lint every package |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm db:push` | Push schema to the database (no migration files) |
| `pnpm db:migrate` | Create + apply a migration |
| `pnpm db:studio` | Open Prisma Studio (visual DB browser) |

**Run a single workspace** with `pnpm --filter <name> <script>`, e.g.:

```bash
pnpm --filter @shipflow/web dev          # run only the web app
pnpm --filter @shipflow/web typecheck    # typecheck only the web app
pnpm --filter @shipflow/api typecheck    # typecheck only the api package
pnpm --filter @shipflow/db db:studio     # Prisma Studio for the db package
```

---

## Environment variables

Copy `.env.example` to `.env`. All variables are loaded at the repo root and shared across packages via Turborepo.

| Variable | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | DB (now) | PostgreSQL connection string |
| `DIRECT_URL` | migrations | Direct (non-pooled) URL; can equal `DATABASE_URL` locally |
| `NEXT_PUBLIC_APP_URL` | web | e.g. `http://localhost:3000` |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | auth (M2) | long random secret + app URL |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET` / `GITHUB_WEBHOOK_SECRET` | GitHub (M5) | GitHub App credentials |
| `ANTHROPIC_API_KEY` | AI (M3+) | Claude via AI SDK |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | workflows (M3+) | Inngest |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | billing (M8) | Razorpay |

---

## Database schema notes

Defined in [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma). PostgreSQL via Prisma; the client is generated to `packages/db/generated/client` and re-exported from `@shipflow/db`.

- **Identity & tenancy:** `User`, `Session`, `Account`, `Verification` (BetterAuth-compatible), `Organization` (workspace), `Membership` (user × org × role).
- **Billing:** `Subscription` (Razorpay), `UsageCounter` (per-org AI credits / repo limits / period).
- **Product domain:** `Project` → `Repository` → `RepoAnalysis`; `FeatureRequest` (with a `FeatureStatus` state machine) → `Prd` → `Task` (Kanban) → `PullRequest` → `Review` → `ReviewIssue` (each issue carries a `rationale` — the _why_).
- **Workflow visibility:** `WorkflowRun` (Inngest progress), `AuditEvent` (activity log).
- **State machine** on `FeatureRequest.status`: `DISCOVERY → CLARIFYING → (REJECTED | PRD_DRAFT) → PRD_APPROVED → TASKS_READY → IN_DEVELOPMENT → IN_AI_REVIEW ⇄ FIX_NEEDED → READY_FOR_APPROVAL → APPROVED → SHIPPED`.

Every tenant-scoped model carries `organizationId` and is indexed accordingly.

---

## GitHub integration setup _(planned: M5)_

Will use Octokit via a **GitHub App** (installation tokens) to connect repositories, receive webhook events (`pull_request`, `push`), fetch changed files/diffs, post review comments, and track PR/review status. Webhook signatures are verified with HMAC-SHA256 over the raw request body at `apps/web/src/app/api/webhooks/github/route.ts`. Setup steps (app creation, permissions, webhook URL) will be documented here once implemented.

## Inngest workflows _(planned: M3+)_

Long-running work runs as Inngest functions, served from `apps/web/src/app/api/inngest/route.ts`, with progress mirrored to the `WorkflowRun` table for in-app visibility:

- `feature/clarify` — requirement clarification, educate-or-reject, PRD generation
- `prd/generate-tasks` — PRD → engineering tasks
- `repo/analyze` — repository analysis to ground reviews
- `pr/ai-review` — diff review against PRD/acceptance/tasks/security/perf/edge/quality (re-runs on new commits)
- `feature/release-readiness` — production-readiness summary for human approval

## AI features _(planned: M3+)_

Powered by the Vercel AI SDK + Claude, all returning Zod-validated structured output (no free-text parsing), and every finding explains _why_:

- Requirement clarification · PRD generation · Task generation · Repository analysis · Code review + QA validation · Release-readiness checks

The reviewer acts as a **QA + engineering reviewer** (does the implementation satisfy the product requirements and is it production-ready), not a syntax checker. **Humans remain the final decision makers.**

---

## Deployment

Target: **Vercel** (web app) + hosted PostgreSQL + Inngest + publicly reachable GitHub/Razorpay webhooks. Detailed deploy steps land with M8.

## License

Private — hackathon project.
