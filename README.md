# ShipFlow AI

> AI-assisted product delivery platform — moves a feature from idea to production through a structured workflow:
>
> **Feature Request → PRD → Tasks → Code → AI Review → Fixes → Re-Review → Human Approval → Ship**

A multi-tenant SaaS where a customer/product-owner request is understood, clarified, turned into a structured PRD, broken into engineering tasks on a Kanban board, connected to a GitHub repository, reviewed by an AI QA/engineering reviewer against the requirements, sent back for fixes, re-reviewed until clean, and finally approved by a human before being marked shipped.

> **Status:** Active build. **M1 (monorepo), M2 (auth + multi-tenant orgs), M3 (feature request → AI PRD), M4 (tasks + Kanban board), and M5 (GitHub integration) are implemented** and deployed as they're verified. Later milestones (AI review, approval, billing) are in progress — see [docs/PLAN.md](docs/PLAN.md). Sections below marked _(planned: Mx)_ are scaffolded but not yet implemented.

---

## How it works (end to end)

What actually happens when a request enters ShipFlow:

| # | Step | What the platform does | Where |
|---|---|---|---|
| 1 | **Request comes in** | Someone submits a feature request (manual, email, ticket, or call) | Feature Requests → *New request* |
| 2 | **AI triage** | An agent decides: ask clarifying questions, **educate** (this likely already exists / shouldn't be built), or proceed | Feature detail |
| 3 | **PRD generated** | Problem, goals, non-goals, user stories, **testable acceptance criteria (with ids)**, edge cases, success metrics | PRD panel |
| 4 | **Human approves the PRD** | Nothing proceeds on AI say-so alone | *Approve PRD* |
| 5 | **Tasks generated** | The PRD is broken into PR-sized tasks, each referencing the acceptance criteria it satisfies | Kanban board |
| 6 | **Team approves the plan** | Tasks are reviewed/edited, then the plan is approved | *Approve plan* |
| 7 | **Code happens** | A repo is connected via the GitHub App; PRs whose branch/body carry the feature id auto-link and move it to *In development* | Settings → GitHub |
| 8 | **AI review** | The PR diff is reviewed against the PRD, acceptance criteria, tasks, security, performance, edge cases, and quality — issues are **blocking / non-blocking**, each explaining *why*, and every acceptance criterion is marked satisfied / partial / not addressed | Feature detail → AI review |
| 9 | **Fix → re-review** | Blocking issues send the feature to *fix needed*; pushing new commits auto-triggers a re-review that knows the previous issues | automatic (webhook) |
| 10 | **Human approval → shipped** _(M7)_ | A reviewer checks the PRD, tasks, PR, and review history, then approves the release | — |

Long-running steps (2, 3, 5, 7-analysis) run as **Inngest workflows** with live progress in the UI, so the request that triggers them returns immediately.

---

## Tech stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Web app | Next.js 16 (App Router, Turbopack, React 19) |
| API | tRPC v11 (type-safe, end-to-end) |
| Data | PostgreSQL + Prisma |
| Auth | BetterAuth (email/password + GitHub, organization plugin) |
| UI | shadcn/ui + Tailwind CSS v4 |
| AI | Vercel AI SDK + Groq (`llama-3.3-70b-versatile`); provider-swappable |
| Async workflows | Inngest |
| GitHub | Octokit (GitHub App + webhooks) |
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
│        │  ├─ api/auth/[...all]/route.ts # BetterAuth handler
│        │  ├─ api/inngest/route.ts       # Inngest serve endpoint (workflows)
│        │  ├─ api/webhooks/github/route.ts # GitHub webhooks (HMAC-verified)
│        │  ├─ (auth)/                     # sign-in / sign-up
│        │  ├─ onboarding/                 # create workspace
│        │  ├─ [orgSlug]/                  # org-scoped app (dashboard, features…)
│        │  ├─ layout.tsx                  # theme + tRPC/React Query providers
│        │  └─ page.tsx                    # landing page
│        ├─ trpc/{client.tsx,server.ts}    # client provider + RSC server caller
│        └─ proxy.ts                       # auth gate (Next 16 middleware)
├─ packages/
│  ├─ db/         # @shipflow/db — Prisma schema + Rust-free client (Neon adapter)
│  ├─ api/        # @shipflow/api — tRPC root router, context, procedures
│  ├─ auth/       # @shipflow/auth — BetterAuth (server + client)
│  ├─ ai/         # @shipflow/ai — AI SDK + Groq, Zod schemas, prompt modules
│  ├─ github/     # @shipflow/github — Octokit GitHub App (repos, diffs, webhooks)
│  ├─ jobs/       # @shipflow/jobs — Inngest client + workflow functions
│  ├─ ui/         # @shipflow/ui — shared cn() util (shadcn lives in web)
│  └─ tsconfig/   # @shipflow/tsconfig — shared TS base configs
├─ docs/          # PLAN.md (roadmap), COMMANDS.md, M2/M3 plans
├─ turbo.json     # task pipeline
└─ pnpm-workspace.yaml
```

**Type-safety spine:** `packages/api` exports the `AppRouter` type; `apps/web` imports it for a fully-typed client. `packages/db` generates Prisma types consumed everywhere. Zod schemas in `packages/ai` are the single contract for AI output, Prisma JSON fields, and tRPC IO. tRPC data is fetched two ways: a **server caller** (`trpc/server.ts`) for React Server Components (in-process, no HTTP) and a **client provider** (`trpc/client.tsx`) using TanStack Query for client components.

**Multi-tenancy:** every tenant-scoped table carries `organizationId`; tRPC's `orgProcedure` verifies membership and surfaces the active org so queries are always tenant-scoped. Routing is path-based (`/[orgSlug]/…`); the org layout syncs the session's active org to the URL.

**Async AI:** tRPC mutations send Inngest events (never run AI inline); Inngest functions in `packages/jobs` execute the long work and mirror step-by-step progress to the `WorkflowRun` table for live in-app status.

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

# 5. Run the app
pnpm dev

# 6. In a SECOND terminal — the Inngest dev server (runs AI workflows)
npx inngest-cli@latest dev
```

Open **http://localhost:3000**, sign up, create a workspace, and submit a
feature request from **Feature Requests** — the AI will clarify or draft a PRD.
Watch workflow runs at the Inngest dashboard **http://localhost:8288**.

> The Inngest dev server (step 6) is required for AI workflows to run locally.
> Without it, a submitted request stays stuck on "AI working…". See
> [docs/COMMANDS.md](docs/COMMANDS.md) for the full local-dev workflow.

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
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | auth (now) | long random secret + app URL (no trailing slash) |
| `GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET` | GitHub login (now) | GitHub OAuth app (for "Continue with GitHub") |
| `GROQ_API_KEY` | AI (now) | free key at console.groq.com/keys |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | workflows (prod only) | Inngest Cloud; local dev needs neither |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_WEBHOOK_SECRET` / `NEXT_PUBLIC_GITHUB_APP_SLUG` | GitHub repos (now) | GitHub App credentials (see GitHub integration setup) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | billing (M8) | Razorpay |

---

## Database schema notes

Defined in [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma). PostgreSQL via Prisma using the **Rust-free client** (`engineType = "client"`) with the **Neon driver adapter** — no native query engine, which is what makes it work on Vercel serverless. The client is generated to `packages/db/generated/client` and re-exported from `@shipflow/db`.

- **Identity & tenancy:** `User`, `Session`, `Account`, `Verification` (BetterAuth), `Organization` (workspace), `Member` (user × org × role), `Invitation`.
- **Billing:** `Subscription` (Razorpay), `UsageCounter` (per-org AI credits / repo limits / period).
- **Product domain:** `Project` → `Repository` → `RepoAnalysis`; `FeatureRequest` (with a `FeatureStatus` state machine) → `Prd` → `Task` (Kanban) → `PullRequest` → `Review` → `ReviewIssue` (each issue carries a `rationale` — the _why_).
- **Workflow visibility:** `WorkflowRun` (Inngest progress), `AuditEvent` (activity log).
- **State machine** on `FeatureRequest.status`: `DISCOVERY → CLARIFYING → (REJECTED | PRD_DRAFT) → PRD_APPROVED → TASKS_READY → IN_DEVELOPMENT → IN_AI_REVIEW ⇄ FIX_NEEDED → READY_FOR_APPROVAL → APPROVED → SHIPPED`.

Every tenant-scoped model carries `organizationId` and is indexed accordingly.

---

## GitHub integration setup

Uses Octokit via a **GitHub App** (installation tokens) — no personal access tokens, no hardcoded PR data. The app connects repositories, receives `pull_request` webhooks (HMAC-SHA256 verified over the raw body at `apps/web/src/app/api/webhooks/github/route.ts`), tracks PRs against features, and fetches changed files/diffs for the AI review.

**One-time app creation** (github.com/settings/apps → New GitHub App):
1. **Webhook URL:** `https://<your-domain>/api/webhooks/github` · **Webhook secret:** a random string
2. **Setup URL** (post-install redirect): `https://<your-domain>/github/setup` (check "Redirect on update")
3. **Repository permissions:** Contents **Read-only** · Pull requests **Read & write** · Metadata **Read-only**
4. **Subscribe to events:** Pull request · Installation target: any account
5. Note the **App ID** + **app slug**, generate a **private key** (.pem)

**Env vars:** `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM on one line, `\n` for newlines), `GITHUB_WEBHOOK_SECRET`, `NEXT_PUBLIC_GITHUB_APP_SLUG`.

**In-app flow:** Settings → GitHub → *Connect GitHub* (installs the app) → connect repos to a project (each connect triggers the AI `repo/analyze` workflow). PRs whose **branch name or body contains a feature's id** auto-link to that feature and move it to *In development*; others can be linked manually on the feature page.

> Webhooks require a publicly reachable URL — test PR tracking against the deployed app (or a smee.io tunnel locally).

## Inngest workflows

Long-running work runs as Inngest functions, served from `apps/web/src/app/api/inngest/route.ts`, with step-by-step progress mirrored to the `WorkflowRun` table for live in-app visibility. tRPC mutations send events; workflows do the heavy lifting so requests stay fast.

Implemented:
- `feature/clarify` — requirement clarification, educate-or-reject, or proceed _(M3)_
- `prd/generate` — generate a structured PRD from the request + clarifying answers _(M3)_
- `tasks/generate` — break an approved PRD into engineering tasks _(M4)_
- `repo/analyze` — analyze a connected repo (tree + manifests → stack/structure/conventions) _(M5)_
- `pr/ai-review` — review a PR against its PRD/tasks, post comments to GitHub, drive FIX_NEEDED ⇄ re-review _(M6)_

Planned:
- `pr/ai-review` _(M6)_ — diff review vs PRD/acceptance/tasks/security/perf/edge/quality (re-runs on new commits)
- `feature/release-readiness` _(M7)_ — production-readiness summary for human approval

**Local dev:** run `npx inngest-cli@latest dev` alongside `pnpm dev` (dashboard at `http://localhost:8288`). **Production:** Inngest Cloud + `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`.

## AI features

Powered by the Vercel AI SDK. Default provider is **Groq** (`llama-3.3-70b-versatile`, free); the provider is isolated to `packages/ai/src/model.ts`, so swapping to Gemini or Claude is a one-line change. All AI returns **Zod-validated structured output** (no free-text parsing).

Implemented:
- **Requirement clarification** _(M3)_ — decide clarify / educate / proceed, with follow-up questions
- **PRD generation** _(M3)_ — structured problem, goals, non-goals, user stories, acceptance criteria (with ids), edge cases, success metrics
- **Task generation** _(M4)_ — break an approved PRD into PR-sized engineering tasks, each referencing the acceptance-criteria ids it satisfies
- **Repository analysis** _(M5)_ — summarize a connected repo's stack, structure, conventions, entry points, and risks to ground PR reviews
- **Code review + QA validation** _(M6)_ — review a PR diff against the PRD, acceptance criteria, tasks, security, performance, edge cases, and quality

Planned:
- Release-readiness checks _(M7)_

The review agent acts as a **QA + engineering reviewer** — it judges whether the implementation *satisfies the product requirements* and is production-ready, not whether the syntax is valid. It is given the PRD, acceptance criteria, engineering tasks, the repo analysis, and (on re-review) the previous unresolved issues. Every issue explains **why** it matters, and each acceptance criterion is marked *satisfied / partial / not addressed* with evidence from the diff. Large diffs are capped and any excluded files are named in the summary rather than silently dropped. **Humans remain the final decision makers** — the AI never ships anything on its own.

---

## Deployment

Target: **Vercel** (web app) + hosted PostgreSQL + Inngest + publicly reachable GitHub/Razorpay webhooks. Detailed deploy steps land with M8.

## License

Private — hackathon project.
