# M8 — Billing + Polish + Deliverables: Plan

**Goal:** turn ShipFlow into a complete SaaS — **Razorpay** billing (free vs paid plans), **usage limits / plan gates** enforced in the API, a polished **landing page**, and the remaining hackathon **deliverables** (full README, demo script). This is the final milestone.

Grounded in the current Razorpay Node SDK: `razorpay` package, `new Razorpay({ key_id, key_secret })`, `subscriptions.create`, Checkout via `checkout.js` with `subscription_id`, and `validatePaymentVerification` / `validateWebhookSignature` (HMAC-SHA256 over the raw body).

---

## What the spec asks for (SaaS requirements)

> Free vs paid plans · Usage limits · AI review credits · Repository limits · Premium workflow features · Billing via Razorpay.

## Plan definitions

| | FREE | PRO | SCALE |
|---|---|---|---|
| Projects | 1 | unlimited | unlimited |
| Repositories | 1 | 10 | unlimited |
| AI review credits / month | 20 | 300 | unlimited |
| Feature requests / month | 10 | unlimited | unlimited |
| Premium (release-readiness, re-review automation) | — | ✅ | ✅ |
| Price | ₹0 | ₹999/mo | ₹2999/mo |

Limits live in one place (`packages/billing/src/plans.ts`) as the single source of truth, keyed by the existing `Plan` enum (FREE/PRO/SCALE) and `UsageCounter` model (both already in the M1 schema).

## What gets built

1. **`packages/billing`** (new) — isolated like the other integrations:
   - Razorpay client singleton (`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`)
   - `plans.ts` — plan metadata + limits (the gate config)
   - `createSubscription()`, `verifyPaymentSignature()`, `verifyWebhookSignature()`
   - `checkLimit(org, metric)` / `incrementUsage()` helpers over `UsageCounter`

2. **Usage enforcement in tRPC** — a `withLimit(metric)` middleware/helper used by the mutations that consume quota:
   - `github.connectRepo` → repository limit
   - `review.run` + auto re-review → AI review credits
   - `featureRequest.create` → feature-request limit
   - returns a clear `FORBIDDEN` ("PRO plan required" / "limit reached") the UI turns into an upgrade prompt.

3. **`billing` tRPC router** — `plans` (list w/ current), `usage` (counters vs limits), `createCheckout` (returns a Razorpay `subscription_id` + key for Checkout), `verifyPayment` (confirm + upgrade the org's `Subscription`/`plan`), `portal`/`cancel`.

4. **Razorpay webhook** — `apps/web/src/app/api/webhooks/razorpay/route.ts`: raw-body signature verify → handle `subscription.activated` / `charged` / `halted` / `cancelled` → keep `Subscription.status` + `Organization.plan` in sync (webhooks are the source of truth, not just the client callback).

5. **Billing UI** — `/[orgSlug]/settings` gains a **Billing** section: current plan, usage bars (credits/repos/features vs limits), plan cards with **Upgrade** (opens Razorpay Checkout via `checkout.js`), and a manage/cancel action. Upgrade prompts appear inline when a gate is hit.

6. **Landing page polish** — a real marketing landing (`/`): hero, the end-to-end loop, feature highlights, pricing, CTA. Currently minimal; make it demo-worthy.

7. **Deliverables (spec-required):**
   - **README** — final pass: overview, tech stack, architecture, setup, env vars, DB schema notes, GitHub setup, Inngest explanation, AI features (most already there from milestone doc-updates; verify completeness).
   - **docs/DEMO.md** — a shot-list/script for the demo video walking the full loop.
   - **Social launch post** — draft the LinkedIn + X posts (tag ChaiCode / Hitesh / Piyush, `Builder Mode On | iPhone Giveaway Hackathon`, `#chaicode`).

## Schema
No new models — `Subscription`, `UsageCounter`, and `Plan` already exist from M1. May add a couple of fields to `Subscription` if Razorpay needs them (e.g. `razorpaySubscriptionId` already present). Confirm during build; `db:push` only if something's added.

## What YOU need to do (Razorpay-side, test mode is free)
1. Razorpay account → **Test mode** (no real money; free).
2. Create **Plans** in the dashboard (PRO, SCALE monthly) → note the `plan_id`s.
3. Get **API keys** (`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — test keys).
4. Create a **webhook** → URL `https://<domain>/api/webhooks/razorpay`, secret = `RAZORPAY_WEBHOOK_SECRET`, events: subscription.* + payment.captured.
5. Add those to `.env` + Vercel.

> Test mode gives fake card numbers, so the whole flow is verifiable end-to-end without spending anything.

## Build order
1. `packages/billing` (client, plans, verify, usage helpers)
2. Enforcement middleware + gate the 3 quota mutations
3. `billing` router + Razorpay webhook route
4. Billing UI + upgrade prompts
5. Landing page polish
6. README final pass + DEMO.md + social post drafts
7. Static checks, docs, hand over Razorpay setup + verification

## Verification (end state)
Free org hits a gate (e.g. connect a 2nd repo) → upgrade prompt → Razorpay Checkout (test card) → payment verified + webhook → org upgraded to PRO → the gate now passes and usage bars update. Downgrade/cancel reflects back via webhook.

## Note
Razorpay is India-focused; test mode works globally for the demo. If live payments aren't needed for judging (they aren't — it's a hackathon), **test mode is sufficient** and costs nothing.
