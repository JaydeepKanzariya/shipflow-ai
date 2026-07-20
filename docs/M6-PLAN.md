# M6 — AI Review Loop: Plan

**Goal (spec Phase 4):** a QA/engineering agent reviews a pull request **against the product requirements**, not just syntax. Issues are categorized **BLOCKING / NON_BLOCKING**, each explaining **why**. Blocking issues send the feature back to `FIX_NEEDED`; new commits trigger a **re-review**; when clean the feature becomes `READY_FOR_APPROVAL`.

> Spec: *"The Agent should act as a QA and engineering reviewer; not merely a syntax checker. It should evaluate whether the implementation actually satisfies the product requirements and is ready for production."*

**No schema changes** — M1 already models `Review`, `ReviewIssue` (with `rationale`), and the `IssueSeverity` / `IssueCategory` / `ReviewVerdict` / `ReviewStatus` enums.

---

## What the reviewer is given (this is what makes it a QA reviewer, not a linter)

Every review call is grounded in the full product context:

| Input | Source | Why it matters |
|---|---|---|
| **PRD** (problem, goals, non-goals, acceptance criteria) | `Prd` | judge *"does this satisfy the requirement?"* |
| **Engineering tasks** + their acceptance refs | `Task[]` | judge *"is the planned work actually done?"* |
| **PR diff** (changed files + patches) | Octokit `getPrFiles()` (M5) | the actual implementation |
| **Repo analysis** (stack, conventions, risks) | `RepoAnalysis` (M5) | judge against *this* codebase's conventions |
| **Previous review issues** (on re-review) | prior `Review`/`ReviewIssue` | check whether feedback was addressed |

## Review dimensions (all seven from the spec)

`PRD` · `ACCEPTANCE` · `SECURITY` · `PERFORMANCE` · `EDGE_CASE` · `QUALITY` — plus an explicit **acceptance-criteria coverage** pass that maps each `ac*` id to *satisfied / partially / not addressed*, so "does it meet the PRD" is answered concretely rather than vibes.

## What gets built

1. **`packages/ai`** — `ReviewSchema` + `reviewPullRequest()`:
   - output: `summary`, `verdict` (APPROVED / CHANGES_REQUESTED / COMMENTED), `acceptanceCoverage[]`, `issues[]`
   - each issue: `severity`, `category`, `title`, `body`, **`rationale` (required — the *why*)**, `suggestion`, `filePath`, `line`
   - prompt is explicit that **only real, evidence-backed problems** count — no nitpicking for its own sake, and it must say when the PR *does* satisfy the criteria.

2. **`packages/github`** — `postReviewComments()`: post a PR review via Octokit with a summary body + inline comments on `filePath`/`line` where available (falls back to summary-only comments when a line isn't in the diff). Stores `githubCommentId` back on each issue.

3. **`packages/jobs`** — `pr/ai-review` Inngest workflow:
   `load context → fetch diff → AI review → persist Review + issues → post to GitHub → set feature status`
   - blocking issues → `FIX_NEEDED`; none → `READY_FOR_APPROVAL`
   - live `WorkflowRun` progress like every other workflow
   - **diff size guard**: cap patch bytes and skip lockfiles/generated dirs so a huge PR doesn't blow the context window (and `log()` what was skipped rather than silently truncating).

4. **Webhook** — handle `pull_request.synchronize` (new commits): auto-enqueue a **re-review** for PRs linked to a feature, and reset `FIX_NEEDED → IN_AI_REVIEW`.

5. **`packages/api`** — `review` router: `byPullRequest`, `history` (all reviews for a feature), `run` (manual "Review now"), `resolveIssue` / `unresolveIssue`.

6. **UI** — on the feature page:
   - **AI review panel** per PR: verdict badge, summary, acceptance-criteria coverage list, issues grouped **Blocking / Non-blocking** with category + *why* + suggestion, resolve toggles, links to the GitHub comment
   - **Review history** (re-review timeline: v1, v2… per head SHA)
   - **"Review now"** button (manual trigger, and the demo path that doesn't depend on webhook timing)

## The loop, concretely

```
PR opened/updated ──► pr/ai-review ──► issues?
                                        ├─ blocking ──► FIX_NEEDED ──┐
                                        └─ none ─────► READY_FOR_APPROVAL
                                                                      │
        new commits (synchronize) ◄── developer pushes fixes ◄────────┘
                    └──► re-review (knows the prior issues)
```

## Risks / decisions

1. **Context size** — big PRs can exceed the model window. Mitigation: per-file patch cap, skip lockfiles/`generated/`/binaries, cap total files, and record what was skipped in the review summary (honest, not silent).
2. **Model quality on Groq** — Llama 3.3 70B is good but this is the most reasoning-heavy prompt in the app. If review quality is weak, swapping `packages/ai/src/model.ts` to Claude is a one-line change (worth considering for the demo).
3. **Posting comments needs `Pull requests: Read & write`** — already granted on the GitHub App in M5. ✅
4. **Re-review triggering** — webhook `synchronize` is the real path; the manual **Review now** button exists so the demo never depends on webhook timing.

## What YOU do
Nothing new to configure — **no new env vars**, GitHub App permissions already correct. At the end: commit/push, then test on the deployed app using the open README PR (smoke test) and ideally a small code PR (meaningful review).

## Verification (end state)
Open a feature with a linked PR → **Review now** → progress runs → review appears with verdict, acceptance coverage, and issues (each with a *why*) → the same feedback appears as comments on the GitHub PR → blocking issues put the feature in **Fix needed** → push a commit → re-review runs → clean review → **Ready for approval**.
