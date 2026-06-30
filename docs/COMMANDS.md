# Command Cheat-Sheet

All commands run from the **repo root** (`d:\Jaydeep\shipflow-ai`) unless noted.

> **If `pnpm` is "not found"** in a fresh terminal, make it available for the session:
> - PowerShell: `$env:Path = "$env:APPDATA\npm;$env:Path"`
> - or just prefix any command with `corepack ` → `corepack pnpm install`

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
`@shipflow/web`, `@shipflow/api`, `@shipflow/db`, `@shipflow/auth`, `@shipflow/ui`.

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

In a second terminal:

```bash
# health.ping — no DB needed; returns ok:true
curl.exe "http://localhost:3000/api/trpc/health.ping?input=%7B%7D"

# health.db — needs DATABASE_URL set + db:push done
curl.exe "http://localhost:3000/api/trpc/health.db?input=%7B%7D"
```

(`%7B%7D` is the URL-encoded empty input `{}` that the tRPC GET adapter expects.)

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `pnpm: command not found` | `$env:Path = "$env:APPDATA\npm;$env:Path"` (PowerShell), or use `corepack pnpm …` |
| `prisma generate` → `EPERM … query_engine-windows.dll.node` | A running dev server holds the DLL. Stop `next dev` / kill stray `node` processes, then retry. |
| `ERR_PNPM_IGNORED_BUILDS` for sharp / prisma | `pnpm rebuild <pkg>` once; they're allow-listed in `pnpm-workspace.yaml`. |
| Port 3000 in use (`EADDRINUSE`) | A previous dev server is still running — stop it, or run on another port: `pnpm --filter @shipflow/web dev -- --port 3001`. |
| IDE can't find `@shipflow/tsconfig/base.json` | Reload window / restart the TS server; the workspace symlink + `exports` resolve it. |
