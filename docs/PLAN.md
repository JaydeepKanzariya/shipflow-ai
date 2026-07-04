# ShipFlow AI — Architecture & Build Plan

> A multi-tenant, AI-assisted product delivery platform.
> Core loop: **Feature Request → PRD → Tasks → Code → AI Review → Fixes → Re-Review → Human Approval → Ship**

> **Progress:**
> - ✅ **M1 — Monorepo foundation** (pnpm + Turborepo, Prisma data model, tRPC end-to-end, proxy auth gate). *Deployed.*
> - ✅ **M2 — Auth + multi-tenant orgs** (BetterAuth email/password + GitHub, organization plugin, org-scoped dashboard, tenancy in tRPC). *Deployed.*
> - ✅ **M3 — Feature request → AI PRD** (discovery triage + PRD generation via Inngest workflows; AI SDK + Groq). Verified locally; see [M3-PLAN.md](M3-PLAN.md).
> - ⏭️ **Next: M4 — Tasks + Kanban board.**
>
> See §6 for the full milestone sequence. Detailed per-milestone plans: [M2-PLAN.md](M2-PLAN.md), [M3-PLAN.md](M3-PLAN.md).
>
> _Note: the original data-model sketch below says `Membership`; the built schema renamed it to `Member` (+ added `Invitation`) to match BetterAuth's org plugin. The AI provider is Groq (not Claude) for now — swappable in one file._

---

## 0. Platform constraints (this modified Next.js 16.2.9)

The bundled docs (`node_modules/next/dist/docs/`) confirm this is real Next.js 16, which differs materially from older App Router knowledge. These shape every decision below:

| Change | Impact on us |
|---|---|
| Middleware → **`proxy.ts`** (`export function proxy`), **Node.js runtime** | Auth gate lives in `proxy.ts`; Prisma/BetterAuth usable there. |
| `cookies()` / `headers()` / `params` / `searchParams` are **async** — must `await` | tRPC context, BetterAuth session reads, every page that reads them. |
| **Turbopack is default**; a custom webpack config **fails the build** | No webpack hacks for Prisma — use `serverExternalPackages` + `transpilePackages`. |
| `fetch` / GET handlers **not cached by default** | Fine — dashboard is dynamic. |
| `cacheComponents` / `'use cache'` opt-in, with strict runtime-API rules | **We keep `cacheComponents` OFF.** A dynamic dashboard + tRPC/React Query avoids the `'use cache'` footguns entirely. |
| Providers must be a separate `'use client'` wrapper, not inline in root layout | Standard tRPC provider pattern. |
| Node **20.9+**, TS **5.1+** | Set `engines`. |

---

## 1. Monorepo structure (tRPC monorepo, required by spec)

Tooling: **pnpm workspaces + Turborepo**. Single Postgres via **Prisma**. Web app is the existing Next.js app, moved to `apps/web`.

```
shipflow-ai/
├─ apps/
│  └─ web/                  # Next.js 16 app (App Router) — UI + route handlers
│     └─ src/app/api/
│        ├─ trpc/[trpc]/route.ts      # tRPC fetch adapter
│        ├─ auth/[...all]/route.ts    # BetterAuth handler
│        ├─ inngest/route.ts          # Inngest serve endpoint
│        └─ webhooks/github/route.ts  # GitHub webhook (raw body verify)
├─ packages/
│  ├─ db/         # Prisma schema + client (singleton)
│  ├─ auth/       # BetterAuth config (server) + client hooks
│  ├─ api/        # tRPC root router, routers, context, procedures
│  ├─ ai/         # AI SDK: PRD/tasks/review prompt modules + schemas (Zod)
│  ├─ github/     # Octokit service (App auth, PRs, diffs, comments)
│  ├─ billing/    # Razorpay service + plan/limit definitions
│  ├─ jobs/       # Inngest client + all workflow functions
│  └─ ui/         # shared shadcn components + Tailwind preset
├─ docs/PLAN.md
├─ turbo.json
├─ pnpm-workspace.yaml
└─ package.json   # workspace root
```

**Type-safety spine:** `packages/api` exports `AppRouter` type; `apps/web` imports it for the typed tRPC client. `packages/db` exports Prisma types consumed everywhere. AI outputs are validated with Zod schemas in `packages/ai` (also the source of truth for PRD/Task/Review shapes).

---

## 2. Data model (Prisma / PostgreSQL) — multi-tenant by `organizationId`

Every tenant-scoped row carries `organizationId`; every tRPC procedure filters by the caller's active org membership.

**Identity & tenancy**
- `User`, `Session`, `Account`, `Verification` — BetterAuth tables
- `Organization` (workspace) — `slug`, `plan`, billing fields
- `Membership` — `userId` × `organizationId` × `role` (OWNER/ADMIN/MEMBER/REVIEWER)
- `Subscription` — Razorpay ids, plan, status, period; `UsageCounter` — per-org AI-review credits / repo count / period

**Product domain**
- `Project` (belongs to Org) — name, description
- `Repository` (belongs to Project) — GitHub `owner/name`, `installationId`, default branch
- `FeatureRequest` — source (EMAIL/TICKET/CALL/MANUAL), raw text, requester, **status** (the state machine below), `clarifyingQA` (JSON)
- `Prd` — problem, goals, nonGoals, userStories, acceptanceCriteria[], edgeCases[], successMetrics[] (structured JSON + editable), version, approvedById?
- `Task` — title, description, acceptanceRefs[], **kanban status** (BACKLOG/TODO/IN_PROGRESS/IN_REVIEW/DONE), order, assignee
- `PullRequest` — GitHub number, branch, state, headSha, linked `featureRequestId`
- `Review` — `pullRequestId`, trigger (AI/HUMAN), verdict, summary, status; `ReviewIssue` — severity (**BLOCKING/NON_BLOCKING**), category (PRD/ACCEPTANCE/SECURITY/PERF/EDGE_CASE/QUALITY), file/line, body, **`rationale` (the *why*, required — spec: "explain why issues exist")**, suggestion, resolved
- `RepoAnalysis` — per-`Repository` AI analysis (stack, structure, conventions, entry points) used to ground PR reviews — spec AI requirement "Repository analysis"
- `InboundMessage` — raw inbound from email/ticket/call ingestion endpoint, linked to the `FeatureRequest` it created (spec: request via "email, support ticket, customer service call, or any mode")
- `WorkflowRun` — Inngest run id, kind, status, progress (for in-app visibility, per spec)
- `AuditEvent` — append-only activity log

**Feature state machine** (drives the UI):
`DISCOVERY → CLARIFYING → (REJECTED | PRD_DRAFT) → PRD_APPROVED → TASKS_READY → IN_DEVELOPMENT → IN_AI_REVIEW → FIX_NEEDED ⇄ IN_AI_REVIEW → READY_FOR_APPROVAL → APPROVED → SHIPPED`
(plus `REJECTED` for "already exists / shouldn't be built" — spec Phase 1).

---

## 3. The core loop — how each phase is wired

| Phase | Trigger | Inngest workflow | AI (AI SDK) | Output |
|---|---|---|---|---|
| **1 Discovery** | User submits request (UI **or** inbound email/ticket/call endpoint) | `feature/clarify` | **Requirement clarification** AI: decide if clarification needed → ask follow-up Qs; if the offering likely **already exists → educate** the user (explain what's there) & allow REJECT; if it genuinely doesn't exist → proceed; then **PRD generation** AI | Clarifying Q&A / educate response / REJECT → structured `Prd` |
| **2 Planning** | PRD approved | `prd/generate-tasks` | **Task generation** AI: PRD → engineering tasks w/ acceptance refs | `Task[]` on Kanban → team review & approve plan |
| **Repo analysis** | Repo connected (and refreshed) | `repo/analyze` | **Repository analysis** AI: stack, structure, conventions, entry points | `RepoAnalysis` — grounds later reviews (spec AI + Inngest requirement) |
| **3 Development** | Repo connected, dev/agent works | — (human/GitHub) | — | PR created → GitHub webhook |
| **4 AI Review** | PR opened/updated webhook | `pr/ai-review` | **Code review + QA validation** AI: fetch diff/changed files via Octokit; review vs PRD + acceptance + tasks + security/perf/edge/quality, grounded in `RepoAnalysis`; categorize BLOCKING/NON_BLOCKING; **each issue carries a `rationale` (why)** | `Review` + `ReviewIssue[]`; posts PR comments; sets FIX_NEEDED or READY_FOR_APPROVAL |
| **Re-review** | New commits webhook | `pr/ai-review` (re-run) | Same, diff-aware | Updated review; loop until clean |
| **5 Approval** | Human reviewer | `feature/release-readiness` | **Release-readiness check** AI: summarize PRD, tasks, PR, AI-review history, outstanding issues; verdict on production-readiness | Human verifies all of the above → APPROVE/REJECT → **SHIPPED** |

All workflows write `WorkflowRun` progress so the UI shows live status (spec requirement). AI calls use **Claude** (`@ai-sdk/anthropic`, model `claude-opus-4-8` for review/PRD quality). Every AI output is a Zod-validated structured object — no free-text parsing, and **every issue explains *why*** (spec: "AI should provide actionable feedback and explain why issues exist"). **No hardcoded PR data** — diffs come from Octokit. The review agent acts as a **QA + engineering reviewer** (does the code satisfy the product requirements / is it production-ready), not a syntax checker; **humans remain the final decision makers**.

---

## 4. Pages (apps/web)

Landing · Auth (sign in/up) · Onboarding (create org) · Dashboard · Workspace settings (members, billing) · Projects · Project view · Feature requests (list + detail w/ clarifying chat) · PRD editor · Task board (Kanban) · GitHub integration (connect repos) · PR reviews (diff + issues) · Review history · Billing (Razorpay checkout) · Final approval & release.

UI: **shadcn/ui + Tailwind v4** (already installed), dark, product-grade.

---

## 5. Integrations (real SDKs — you'll supply keys)

- **Auth:** BetterAuth (email/password + GitHub OAuth), Prisma adapter, organization plugin for multi-tenancy.
- **GitHub:** Octokit via **GitHub App** (installation tokens) — connect repos, read diffs/files, post review comments, receive webhooks (`pull_request`, `push`) with HMAC-256 signature verification (raw body).
- **AI:** Vercel AI SDK + `@ai-sdk/anthropic`, `generateObject` with Zod schemas.
- **Async:** Inngest (`inngest serve` route handler) for all long-running flows.
- **Billing:** Razorpay subscriptions + webhook; plan gates (free vs paid: repo limit, AI-review credits, premium workflow features) enforced in tRPC middleware.
- **DB:** PostgreSQL + Prisma.

`.env` keys I'll need from you (prompted as we reach each): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GITHUB_APP_ID/PRIVATE_KEY/CLIENT_ID/CLIENT_SECRET/WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `INNGEST_EVENT_KEY/SIGNING_KEY`, `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`.

---

## 6. Build sequence (incremental, verifiable at each step)

**M1 — Monorepo + foundation:** pnpm workspaces, Turborepo, move web → `apps/web`, `packages/db` (Prisma schema above) + migrate, `packages/api` tRPC skeleton + provider wiring (`'use client'` providers), `proxy.ts` auth gate. *Verify: app boots, typed `trpc.health` query works.*

**M2 — Auth + tenancy:** BetterAuth, org creation/onboarding, membership + role middleware, protected dashboard shell + nav. *Verify: sign up → create org → land in dashboard.*

**M3 — Feature → PRD (Phase 1):** feature request CRUD + sources, **inbound ingestion endpoint** (email/ticket/call → `InboundMessage` → FeatureRequest), Inngest `feature/clarify` (clarify / **educate** / reject / draft PRD), PRD editor, approve. *Verify: submit request (UI + inbound endpoint) → get clarifying Qs or educate response → PRD generated & editable.*

**M4 — Tasks + Kanban (Phase 2):** `prd/generate-tasks`, drag-and-drop board, **team plan review & approval**. *Verify: approved PRD → tasks on board → approve plan.*

**M5 — GitHub (Phase 3):** GitHub App connect, repo list, **`repo/analyze` workflow → `RepoAnalysis`**, PR tracking, webhook endpoint + signature verify. *Verify: connect repo → analysis runs; open a real PR → it appears linked.*

**M6 — AI Review loop (Phase 4):** `pr/ai-review` (Octokit diff → Claude review → issues + PR comments), re-review on push, FIX_NEEDED ⇄ review. *Verify: PR reviewed against PRD, issues posted, loop closes.*

**M7 — Approval + Ship (Phase 5):** release-readiness, human approve/reject, SHIPPED. *Verify: full loop end-to-end on one feature.*

**M8 — Billing + polish:** Razorpay plans/limits/credits (free vs paid, usage limits, AI-review credits, repo limits, premium workflow features), landing page, full README, deploy to Vercel, demo-ready.

---

## 6a. Required non-code deliverables (tracked, not optional)

These come straight from the spec and are easy to forget — listing them so none slip:

- [ ] **Launch post** — LinkedIn **and** X/Twitter, at the *start* of the build. Tag **ChaiCode, Hitesh Sir, Piyush**. End with the exact line `Builder Mode On | iPhone Giveaway Hackathon`. Hashtag `#chaicode`. *(I'll draft both posts for you; you publish.)*
- [ ] **Public GitHub repository** — repo must be public.
- [ ] **Live deployed project** — Vercel (web) + hosted Postgres + Inngest + webhooks reachable publicly.
- [ ] **Demo video** — walk the full core loop end-to-end. *(I'll draft a script/shot-list.)*
- [ ] **README** must include, explicitly: project overview · tech stack · architecture · setup instructions · environment variables · **database schema notes** · **GitHub integration setup** · **Inngest workflow explanation** · **AI features implemented**.

---

## 7. Decisions I'm making by default (flag if you disagree)

1. **pnpm + Turborepo** for the monorepo (most common, best DX). 
2. **cacheComponents OFF** — dynamic dashboard via tRPC/React Query; avoids `'use cache'` runtime-API restrictions.
3. **Claude (`claude-opus-4-8`)** as the AI provider via AI SDK.
4. **GitHub App** (not personal OAuth tokens) for repo access — required for webhooks + installation tokens at scale.
5. **Path-based tenancy** (`/app/[orgSlug]/...`) over subdomains — simpler for hackathon + Vercel.
6. Build **incrementally on `master`** with a commit per milestone (you haven't asked for a branch/PR workflow).
