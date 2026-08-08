# Demo Video — Shot List & Script

Target length: **3–5 minutes.** Show the **core loop end to end** on one real feature, then the SaaS bits. Record at 1080p, dark theme, on the deployed site.

> Tip: seed a clean org before recording so usage counters and history look tidy. Have one connected repo already analyzed.

---

## 0. Cold open (10s)
- Landing page (`/`). One line: *"ShipFlow takes a feature from request to production — with an AI QA reviewer and a human approval gate."*

## 1. Sign in → workspace (15s)
- Sign in → dashboard. Mention **multi-tenant workspaces** (org switcher top-left).

## 2. Feature request → PRD (45s)  *(Phase 1)*
- **Feature Requests → New request.** Submit something real, e.g.:
  > "Add a health check endpoint so uptime monitoring can verify the app is live."
- Show the **"AI working…"** progress card (Inngest workflow, live).
- PRD appears — walk the sections (problem, goals, **acceptance criteria with ids**). Click **Approve PRD**.

## 3. Tasks on the board (30s)  *(Phase 2)*
- Tasks generate → the **Kanban board**. Drag one card between columns (optimistic).
- Click **Approve plan** → status **Tasks ready**.

## 4. Connect GitHub + a PR (30s)  *(Phase 3)*
- (Pre-connected repo in Settings → GitHub, with an AI **repo analysis** summary — show briefly.)
- Open a PR on the repo that implements the endpoint, with the **feature id in the description**.
- Back in the app: the PR **auto-links**, status → **In development**.

## 5. AI review (60s)  *(Phase 4 — the centerpiece)*
- On the feature, the **AI review** panel → **Review now**.
- Show the result: **verdict**, per-**acceptance-criterion coverage** (satisfied/partial/none), and issues grouped **blocking / non-blocking**, each with a **"Why."**
- Open the **GitHub PR** in a tab — the same review is posted as a comment. Emphasize: *"reviewed against the PRD, not just syntax — and no hardcoded data."*
- (Optional) Push a commit → **auto re-review** fires.

## 6. Human approval → ship (40s)  *(Phase 5)*
- **Approval & release** panel → **Check readiness** → the AI **release brief** (checks, risks).
- **Approve release** → **APPROVED** → **Mark as shipped** → **SHIPPED 🚀**.
- Line: *"The AI advises; a human decides. Only approved features ship."*

## 7. SaaS: billing + limits (30s)
- **Settings → Billing.** Usage bars (credits/repos/requests vs plan limits).
- Trigger a gate (e.g. try connecting a 2nd repo on Free) → **upgrade prompt**.
- **Upgrade** → Razorpay Checkout (test card) *or* the demo upgrade → plan flips to Pro, limits update.

## 8. Close (10s)
- Back to the loop diagram on the landing page. *"Request → PRD → Tasks → Code → AI Review → Approval → Ship. Built as a tRPC monorepo on Next.js, Inngest, Octokit, and the AI SDK."*

---

## Test cards (Razorpay test mode)
- Card: `4111 1111 1111 1111`, any future expiry, any CVV, any name. (Or use the demo-upgrade button if Razorpay isn't configured.)

## What to have open in tabs beforehand
1. The deployed app (signed in)
2. The GitHub repo (to open the PR)
3. The Inngest dashboard (optional — to show a workflow run)
