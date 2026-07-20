# M5 — GitHub Integration: Plan

**Goal (spec Phase 3 — Development):** connect GitHub repositories to a workspace via a **GitHub App**, receive **webhook** events, track **pull requests** against feature requests, fetch changed files/diffs (consumed by M6's AI review), and run the **repo/analyze** AI workflow. No hardcoded PR data — everything comes from Octokit/webhooks.

Verified against current Octokit docs: all-in-one `octokit` package, `App` class (`appId` + `privateKey`), `app.getInstallationOctokit(installationId)`, and `app.webhooks.verifyAndReceive()` for serverless signature verification (HMAC over the raw body).

---

## How the pieces fit

```
GitHub App (you create once)
  └─ user installs it on their account/repos → installation_id
       └─ stored on Organization.githubInstallationId
            └─ list installation repos → user connects repos to a project
                 └─ Repository rows (owner/name/installationId)
                      ├─ repo/analyze (Inngest + AI) → RepoAnalysis
                      └─ webhooks: pull_request events → PullRequest rows
                           └─ linked to a FeatureRequest (auto by branch/body
                              containing the feature id, or manually in UI)
                                └─ feature status → IN_DEVELOPMENT
```

## What gets built

1. **Schema** — add `githubInstallationId String?` to `Organization` (remembers the installation for "add more repos"). Everything else (`Repository`, `PullRequest`, `RepoAnalysis`) already exists from M1. → needs a `db:push` (you run it).

2. **`packages/github`** (new) — Octokit service, isolated like `packages/ai`:
   - `App` singleton from `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` (PEM stored with `\n` escapes; normalized in code) + `GITHUB_WEBHOOK_SECRET`
   - helpers: `getInstallationClient()`, `listInstallationRepos()`, `getPrFiles()` (diff/patches for M6), `getRepoOverview()` (tree + key files for analysis), `verifyWebhook()`

3. **Webhook endpoint** — `apps/web/src/app/api/webhooks/github/route.ts` (POST):
   - raw-body HMAC verification via `verifyAndReceive`
   - `installation` events → keep `githubInstallationId` in sync
   - `pull_request` events (opened/synchronize/reopened/closed/merged) → upsert `PullRequest`, auto-link to a feature when the branch name or PR body contains the feature id, set feature → `IN_DEVELOPMENT`

4. **`api` routers**:
   - `github`: `installUrl` (App install link), `connectInstallation` (setup callback), `status`, `availableRepos`, `connectRepo` (creates Repository + kicks `repo/analyze`), `connectedRepos`, `disconnectRepo`
   - `pullRequest`: `byFeature`, `listUnlinked`, `link`/`unlink`

5. **`jobs`** — `repo/analyze` Inngest workflow: fetch repo tree + key files via Octokit → AI summary (stack, structure, conventions) → `RepoAnalysis` row (grounds M6 reviews). New AI prompt `analyzeRepo()` + schema in `packages/ai`.

6. **UI**:
   - **Settings → GitHub** page (`/[orgSlug]/settings`): connect GitHub button (install link), installation status, available repos → connect to project, connected repo list w/ analysis status
   - **Feature detail**: “Pull requests” section — linked PRs (status, branch, link to GitHub), manual link picker for unlinked PRs
   - GitHub setup callback route (`/github/setup`) → stores installation, redirects to settings

## What YOU need to do (GitHub-side, ~10 min)

1. **Create a GitHub App** (github.com/settings/apps → New GitHub App):
   - Name: e.g. `shipflow-ai-jaydeep` (must be globally unique)
   - Homepage URL: your Vercel URL
   - **Webhook URL:** `https://shipflow-ai-green.vercel.app/api/webhooks/github`
   - **Webhook secret:** generate a random string (save it)
   - **Permissions (Repository):** Contents **Read-only**, Pull requests **Read & write**, Metadata **Read-only**
   - **Subscribe to events:** Pull request
   - Where can it be installed: Any account
2. After creating: note the **App ID**, the **app slug** (from its URL), and **generate a private key** (downloads a `.pem`).
3. Env vars (local `.env` + Vercel): `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM contents with `\n` for newlines), `GITHUB_WEBHOOK_SECRET`, `NEXT_PUBLIC_GITHUB_APP_SLUG`.

> **Local webhook caveat:** GitHub can't reach `localhost`, so webhook-driven PR tracking is tested against the **deployed** app (or via a smee.io tunnel). Everything else (connect, repo list, analyze) works locally.

## Build order
1. Schema + `packages/github` + webhook route
2. `github`/`pullRequest` routers + `repo/analyze` workflow
3. Settings UI + feature-detail PR section
4. Static checks, docs, then your GitHub App setup + runtime verification

## Verification (end state)
Install the App on a repo → connect it to the project → `repo/analyze` runs (visible progress) → open a real PR on that repo with the feature id in the branch/body → it appears on the feature (status `IN_DEVELOPMENT`) → diff fetchable (proven in M6).
