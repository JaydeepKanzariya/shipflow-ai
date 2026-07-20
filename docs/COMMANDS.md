# Command Cheat-Sheet

All commands run from the **repo root** (`d:\Jaydeep\shipflow-ai`) unless noted.

> **If `pnpm` is "not found"** in a fresh terminal, make it available for the session:
> - PowerShell: `$env:Path = "$env:APPDATA\npm;$env:Path"`
> - or just prefix any command with `corepack ` → `corepack pnpm install`

---

## Local development (two terminals)

Since M3, the app has **async workflows** (Inngest) that run PRD generation, etc.
For those to execute locally you need **two processes running side by side**:

**Terminal 1 — the app:**
```bash
pnpm dev
```

**Terminal 2 — the Inngest dev server** (runs the background workflows):
```bash
npx inngest-cli@latest dev
```
- It auto-discovers the app at `http://localhost:3000/api/inngest`.
- Dashboard to watch runs/steps: **http://localhost:8288**
- No account or keys needed for local dev.

> If you only run `pnpm dev` (no Inngest), a submitted feature request will
> sit stuck on "AI working…" forever, because nothing processes the workflow.

Requires `GROQ_API_KEY` in `.env` for the AI steps (get a free key at
https://console.groq.com/keys). See `.env.example` for all variables.

---

## Everyday

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start all apps in dev mode (via Turborepo) |
| `pnpm build` | Production build of the whole monorepo |
| `pnpm start` | Start the production build |
| `pnpm typecheck` | Typecheck every package |
| `pnpm lint` | Lint every package |

## Database (Prisma)

| Command | Description |
|---|---|
| `pnpm db:generate` | Generate the Prisma client (after editing `schema.prisma`) |
| `pnpm db:push` | Push schema to the DB without migration files (fast, dev) |
| `pnpm db:migrate` | Create + apply a migration (keeps history) |
| `pnpm db:studio` | Open Prisma Studio — visual DB browser |

---

## Running a specific app or package

Use pnpm's `--filter` to target one workspace. Package names:
`@shipflow/web`, `@shipflow/api`, `@shipflow/db`, `@shipflow/auth`,
`@shipflow/ai`, `@shipflow/github`, `@shipflow/jobs`, `@shipflow/ui`.

```bash
# Web app only
pnpm --filter @shipflow/web dev          # dev server on http://localhost:3000
pnpm --filter @shipflow/web build        # build only the web app
pnpm --filter @shipflow/web start        # start the built web app
pnpm --filter @shipflow/web lint         # lint only the web app
pnpm --filter @shipflow/web typecheck    # typecheck only the web app

# A package only
pnpm --filter @shipflow/api typecheck    # typecheck the tRPC api package
pnpm --filter @shipflow/db  db:generate  # regenerate Prisma client
pnpm --filter @shipflow/db  db:studio    # Prisma Studio
```

Turborepo equivalents (run a task across the graph, with caching):

```bash
pnpm turbo run typecheck --filter=@shipflow/web   # task + its deps
pnpm turbo run build --filter=@shipflow/web...    # web + everything it depends on
```

---

## Verifying the API by hand (while `pnpm dev` runs)

In a separate terminal:

```bash
# health.ping — no DB needed; returns ok:true
curl.exe "http://localhost:3000/api/trpc/health.ping?input=%7B%7D"

# health.db — needs DATABASE_URL set + db:push done
curl.exe "http://localhost:3000/api/trpc/health.db?input=%7B%7D"
```

(`%7B%7D` is the URL-encoded empty input `{}` that the tRPC GET adapter expects.)

## Watching AI workflows

- Inngest dashboard (local): **http://localhost:8288** → Runs / Functions tab
  shows each `feature-clarify` / `prd-generate` run, its steps, and any error.
- In-app: a feature's detail page shows live "AI working…" progress.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `pnpm: command not found` | `$env:Path = "$env:APPDATA\npm;$env:Path"` (PowerShell), or use `corepack pnpm …` |
| `prisma generate` → `EPERM … query_engine-windows.dll.node` | A running dev server holds the DLL. Stop `next dev` / kill stray `node` processes, then retry. |
| `ERR_PNPM_IGNORED_BUILDS` for sharp / prisma / protobufjs | Approved in `pnpm-workspace.yaml` (`allowBuilds`); run `pnpm install` again, or `pnpm rebuild <pkg>`. |
| Port 3000 in use (`EADDRINUSE`) | A previous dev server is still running — stop it, or run on another port: `pnpm --filter @shipflow/web dev -- --port 3001`. |
| IDE can't find `@shipflow/tsconfig/base.json` | Reload window / restart the TS server; the workspace symlink + `exports` resolve it. |
| Feature request stuck on "AI working…" forever | The Inngest dev server isn't running — start `npx inngest-cli@latest dev` in a second terminal. |
| Workflow fails with a quota / `limit: 0` error | AI provider issue, not code. Check `GROQ_API_KEY` in `.env`; see the error at http://localhost:8288. |
| Edited `.env` but change not picked up | Restart `pnpm dev` — env is loaded at boot (root `.env` via `next.config.ts`). |
| GitHub PRs not appearing in the app | Webhooks need a public URL — GitHub can't reach localhost. Test PR tracking on the deployed app, or tunnel with smee.io. Check delivery status under the GitHub App → Advanced → Recent Deliveries. |
| "GitHub App not configured" error | Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (one line, `\n` escapes), `GITHUB_WEBHOOK_SECRET`, `NEXT_PUBLIC_GITHUB_APP_SLUG` — then restart dev / redeploy. |
