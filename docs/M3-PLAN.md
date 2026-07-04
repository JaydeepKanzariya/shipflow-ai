# M3 — Feature Request → PRD: Plan

**Goal (spec Phase 1 — Product Discovery):** a user submits a feature request; an AI agent decides whether to **clarify** (ask follow-up questions), **educate/reject** (offering may already exist / shouldn't be built), or **proceed** — then generates a structured **PRD**. Users can view/edit the PRD and approve it. All AI work runs as **async Inngest workflows** with progress visible in-app.

Verified against current AI SDK (`generateText` + `Output.object` / `generateObject`, Zod schemas, `@ai-sdk/anthropic`) and Inngest (`serve()` at `/api/inngest`, `createFunction` + `step.run`).

---

## What gets built

### 1. `packages/ai` — the AI layer (new)
- `@ai-sdk/anthropic` + `ai` + `zod`. Model: **`claude-opus-4-8`** (quality matters for PRD/review).
- **Zod schemas** = the single source of truth for AI output shapes (also used by Prisma JSON fields + tRPC): `ClarificationSchema`, `PrdSchema` (problem, goals, nonGoals, userStories, acceptanceCriteria[], edgeCases, successMetrics).
- **Prompt modules** (pure functions, testable):
  - `assessRequest()` → returns `{ decision: "clarify" | "educate" | "proceed", questions?, educateMessage?, reasoning }` — the discovery triage.
  - `generatePrd()` → returns a validated `PrdSchema` object from the request + clarifying answers.
- Thin `runStructured()` wrapper around `generateObject` with error handling + the model config in one place.

### 2. `packages/jobs` — Inngest workflows (new)
- `inngest` client (`id: "shipflow"`).
- Functions:
  - **`feature/clarify`** — on `feature.submitted`: run `assessRequest`; write clarifying questions / educate message / decision back to the `FeatureRequest`; advance status (`DISCOVERY → CLARIFYING` or `REJECTED` or straight to PRD).
  - **`prd/generate`** — on `feature.clarified` (answers collected) or direct proceed: run `generatePrd`; upsert the `Prd` row; status → `PRD_DRAFT`.
- Each `step.run` step **updates the `WorkflowRun` row** (progress steps) so the UI can show live status (spec requirement).
- All DB writes via `@shipflow/db`; all AI via `@shipflow/ai`.

### 3. `apps/web` — Inngest endpoint + wiring
- **`/api/inngest/route.ts`** — `serve({ client, functions })` exporting GET/POST/PUT.
- tRPC mutations **send Inngest events** (`inngest.send`) rather than calling AI inline (keeps requests fast, work async).

### 4. `packages/api` — feature + PRD tRPC routers
- **`featureRequest` router** (all `orgProcedure`, tenant-scoped):
  - `create` (title, rawText, source, projectId) → writes row, creates a `WorkflowRun`, sends `feature.submitted`.
  - `list` / `byId` (with prd + workflow runs + tasks count).
  - `submitAnswers` (clarifying Q&A) → sends `feature.clarified`.
  - `reject` / `reconsider` (manual override of the educate decision).
  - `regeneratePrd`.
- **`prd` router**: `byFeature`, `update` (manual edits to the structured PRD), `approve` (sets approvedBy/At, status → `PRD_APPROVED`; owner/admin only via `roleProcedure`).
- Mount both on `appRouter`.

### 5. `apps/web` — pages (under `/[orgSlug]/`)
- **Feature requests list** `/[orgSlug]/features` — table with status badges (the state machine), "New request" button.
- **New request** dialog/page — title, description, source (email/ticket/call/manual), project.
- **Feature detail** `/[orgSlug]/features/[id]`:
  - Status timeline + live **WorkflowRun progress** (poll or refetch).
  - **Clarifying chat panel** — shows AI questions, collects answers, submit.
  - **Educate/reject panel** — when AI says it may already exist, show the message + "Proceed anyway" / "Reject".
  - **PRD view/editor** — structured sections (problem, goals, non-goals, user stories, acceptance criteria, edge cases, success metrics), inline edit, **Approve** button.
- shadcn additions as needed: `textarea`, `badge`, `dialog`, `select`, `tabs`, `skeleton`.

---

## Data model
No schema changes needed — M1 already has `FeatureRequest` (with `clarifyingQA`, `decisionNote`, status state machine), `Prd` (all structured JSON fields), and `WorkflowRun`. M3 just populates them. (If PRD editing needs finer structure we may add columns, but the JSON fields cover it.)

---

## New dependencies
- `packages/ai`: `ai`, `@ai-sdk/anthropic`, `zod`
- `packages/jobs`: `inngest`, `@shipflow/db`, `@shipflow/ai`
- `apps/web`: `inngest` (for the serve route + `inngest.send` types)

## What I need from you
1. **`ANTHROPIC_API_KEY`** — required for any AI step. Get from console.anthropic.com. Add to `.env` (local) and Vercel env vars.
2. **Inngest** — for local dev, the **Inngest Dev Server** runs with `npx inngest-cli dev` (no account needed to test locally). For production on Vercel you'll need an Inngest account → `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY`, and to register the `/api/inngest` URL in the Inngest dashboard.

## Build order (each verifiable)
1. `packages/ai` — schemas + prompt modules; unit-test `assessRequest`/`generatePrd` with a real key (small script).
2. `packages/jobs` — Inngest client + the two functions; `/api/inngest` route.
3. `packages/api` — featureRequest + prd routers; mount.
4. Wire mutations → Inngest events; WorkflowRun progress updates.
5. UI: features list → new request → detail (clarify/educate/PRD) → approve.
6. Verify full Phase-1 loop.

## Verification (end state)
Create a feature request → Inngest `feature/clarify` runs (visible progress) → either clarifying questions appear (answer them) or an educate message → PRD generated and shown in the editor → edit a section → approve → status becomes `PRD_APPROVED`. Test one "should clarify" request and one "already exists → educate" request.

## Local dev note (two processes)
M3 introduces async workflows, so local dev needs **two terminals**: `pnpm dev` (the app) **and** `npx inngest-cli dev` (the Inngest dev server that runs the functions). I'll document this in the README/COMMANDS.

---

## Decisions (flag if you disagree)
1. **New `packages/ai` and `packages/jobs`** (vs. folding into `api`) — keeps AI prompts and async workflows independently testable and reusable across later milestones (M4 tasks, M6 review all reuse them).
2. **AI runs only inside Inngest**, never inline in a tRPC request — requests stay fast; all long work is async with visible progress (matches the spec).
3. **Model `claude-opus-4-8`** for discovery/PRD quality. Can drop to a cheaper model for simple steps later if cost matters.
4. **Zod schemas are the contract** — same schema validates the AI output, shapes the Prisma JSON, and types the tRPC IO.
5. **PRD stored as structured JSON** in the existing `Prd` columns; editing is section-based, not free-text markdown.
