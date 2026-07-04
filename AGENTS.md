<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git workflow

**Never run `git commit`, `git push`, or any history-changing git command.** The user commits and pushes everything themselves. When work is ready to commit, do NOT stage or commit it — instead, provide the commit message(s) and the exact commands for the user to run, and let them do it.

# Running / verifying

**The user runs all runtime, database, and verification commands themselves** so they can watch the output. The agent must NOT run: dev servers (`pnpm dev`, `next dev`), database commands (`db:push`, `db:migrate`, `prisma generate`, `prisma migrate`, Prisma scripts/queries), or endpoint checks (`curl`, HTTP probes) — anything that boots, serves, or hits the DB/network. Instead, provide the exact command(s) and state what to look for; the user runs them and reports back. The agent MAY still edit files, search/read, and run pure static checks (`pnpm install`, `tsc --noEmit`/typecheck, `eslint`/lint).

# Docs: keep in sync every milestone

**When a milestone is completed and verified, update the docs as part of that same milestone's work — automatically, without being asked — before handing over the commit.** Review and update as needed:
- `README.md` — status line, tech-stack table, architecture tree, setup/commands, env-var table, database-schema notes, and flip the relevant _(planned: Mx)_ sections to implemented (leave still-upcoming ones marked).
- `docs/PLAN.md` — progress banner (mark the milestone done, name the next one).
- `docs/COMMANDS.md` — any new commands, dev processes, or troubleshooting the milestone introduced.
- `.env.example` — any new environment variables.

Only claim something is "implemented" if it actually is; keep honest _(planned)_ markers on anything not yet built. Do not reference files, commands, or features that don't exist.
