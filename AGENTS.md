<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git workflow

**Never run `git commit`, `git push`, or any history-changing git command.** The user commits and pushes everything themselves. When work is ready to commit, do NOT stage or commit it — instead, provide the commit message(s) and the exact commands for the user to run, and let them do it.

# Running / verifying

**The user runs all runtime, database, and verification commands themselves** so they can watch the output. The agent must NOT run: dev servers (`pnpm dev`, `next dev`), database commands (`db:push`, `db:migrate`, `prisma generate`, `prisma migrate`, Prisma scripts/queries), or endpoint checks (`curl`, HTTP probes) — anything that boots, serves, or hits the DB/network. Instead, provide the exact command(s) and state what to look for; the user runs them and reports back. The agent MAY still edit files, search/read, and run pure static checks (`pnpm install`, `tsc --noEmit`/typecheck, `eslint`/lint).
