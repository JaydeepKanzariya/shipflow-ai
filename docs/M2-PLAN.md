# M2 — Auth + Tenancy: Plan

Goal: a user can **sign up → create an organization → land in a protected, org-scoped dashboard**, with role-aware tRPC procedures enforcing tenant isolation.

Verified against current BetterAuth docs (installation + organization plugin) — the API below matches the live library, not assumptions.

---

## What gets built

### 1. `packages/auth` — real BetterAuth config (replaces today's stub)
- `betterAuth()` instance with **Prisma adapter** (`prismaAdapter(prisma, { provider: "postgresql" })`), reusing `@shipflow/db`'s client singleton.
- **Email/password** enabled + **GitHub social provider** (login; the GitHub *App* for repo access is separate, comes in M5).
- **`organization()` plugin** for multi-tenant workspaces (gives us orgs, members, invitations, and `session.activeOrganizationId`).
- Real `getAuthFromHeaders(headers)` → calls `auth.api.getSession({ headers })`, returns `{ userId, activeOrganizationId } | null` (the shape `packages/api` already consumes — no API changes needed).
- Client: `createAuthClient` with `organizationClient()` plugin, exporting `signIn/signUp/signOut/useSession` + org hooks.

### 2. `packages/db` — reconcile schema with BetterAuth (the one real design task)
BetterAuth's org plugin expects tables named `organization`, `member`, `invitation`, and `session.activeOrganizationId`. My M1 schema has `Organization` + `Membership` with custom fields. Reconciliation:
- **Keep** `User`, `Session` (already has `activeOrganizationId` ✓), `Account`, `Verification`, `Organization` — these already align.
- **Rename `Membership` → `Member`** (`@@map("member")`) to match the plugin, keep my `role` + `organizationId`/`userId`.
- **Add `Invitation`** model (plugin requirement: email, role, status, expiresAt, inviterId, organizationId).
- Confirm field names the plugin needs exist (e.g. `Member.role`, `Organization.slug`). Run BetterAuth's schema generator to diff, then reconcile by hand so my extra domain fields survive.
- `db:push` (or a migration) to apply.

### 3. `apps/web` — auth routes, pages, and the org-scoped shell
- **`/api/auth/[...all]/route.ts`** — `toNextJsHandler(auth)` (GET/POST).
- **Pages (public):** `/sign-in`, `/sign-up` (shadcn forms, email/password + "Continue with GitHub").
- **`/onboarding`** — create first organization (name → slug), sets it active, redirects to the dashboard.
- **Org-scoped routes** under `/[orgSlug]/` (path-based tenancy):
  - `/[orgSlug]/dashboard` — protected shell: sidebar nav, org switcher, user menu, sign-out.
  - layout resolves the org from the slug, verifies membership, 404/redirect if not a member.
- **`proxy.ts`** — enable the real redirect: unauthenticated → `/sign-in`; authed but no org → `/onboarding`. (Cheap cookie check only; real authz stays in tRPC + the layout.)

### 4. `packages/api` — tenancy enforcement
- `protectedProcedure` already checks `ctx.auth`; **add real membership verification** to `orgProcedure`: look up `Member` by `(userId, activeOrganizationId)`, attach `role` + `organizationId` to ctx, throw `FORBIDDEN` if not a member.
- Add a **`roleProcedure(minRole)`** helper (OWNER > ADMIN > MEMBER > REVIEWER) for routes that need elevation.
- New **`organization` router**: `list` (my orgs), `create`, `setActive`, `current`, `members.list`. (Thin wrappers over BetterAuth's server API where it makes sense, or direct Prisma for reads — to keep them tRPC-typed.)
- Mount it on `appRouter`.

### 5. shadcn/ui foundation (first real components)
- Initialize shadcn in `apps/web` (or `packages/ui`) + add the components the auth/dashboard need: `button`, `input`, `label`, `card`, `form`, `dropdown-menu`, `avatar`, `sonner` (toasts).
- Dark, product-grade theme tokens in `globals.css`.

---

## New dependencies
- `better-auth` (root of `packages/auth` + web client)
- shadcn/ui peer deps: `@radix-ui/*` (per component), `class-variance-authority`, `lucide-react` (already have `clsx` + `tailwind-merge` in `@shipflow/ui`)

## What I need from you
1. **`DATABASE_URL`** (+ `DIRECT_URL`) — a PostgreSQL instance (local or hosted). Required to run `db:push` and test the full flow.
2. **`BETTER_AUTH_SECRET`** — I can generate one, or you provide it.
3. **(Optional now) GitHub OAuth app** `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — only needed to test "Continue with GitHub". Email/password works without it; I can stub GitHub login until you create the OAuth app.

## Build order (each step verifiable)
1. Schema reconciliation (Member/Invitation) + `db:push`.
2. `packages/auth` real config + client.
3. Auth route handler + sign-in/sign-up pages → verify email/password signup writes a `user` row.
4. Onboarding (create org) + `organization` router → verify org + member rows, session active org set.
5. Org-scoped dashboard shell + `proxy.ts` redirects → verify protected routing.
6. tRPC `orgProcedure` membership enforcement + `roleProcedure` → verify a non-member is blocked.

## Verification (end state)
Sign up → redirected to onboarding → create "Acme" → land on `/acme/dashboard`; refresh keeps you in; sign out → `/sign-in`; hitting `/acme/dashboard` while signed out redirects; a tRPC `orgProcedure` call returns data only for orgs you belong to.

---

## Decisions (flag if you disagree)
1. **Use BetterAuth's `organization` plugin** for tenancy (vs. rolling my own) — it owns members/invitations/active-org and integrates with the session cleanly. My domain tables (Project, Repository, etc.) still key off `organizationId`.
2. **Rename `Membership`→`Member`** to match the plugin rather than fighting it with custom model mapping.
3. **shadcn components live in `apps/web`** initially (simplest); promote shared ones to `packages/ui` later if a second app appears.
4. **Email/password first**, GitHub OAuth login wired but testable only once you add the OAuth app.
