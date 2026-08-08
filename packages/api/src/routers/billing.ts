import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  PLANS,
  PLAN_ORDER,
  getOrgPlan,
  getAllUsage,
  isRazorpayConfigured,
  createSubscription,
  verifyPaymentSignature,
  razorpayKeyId,
  razorpayPlanId,
  type PlanId,
} from "@shipflow/billing";
import { orgProcedure, roleProcedure, router } from "../trpc";

const PAID_PLANS = z.enum(["PRO", "SCALE"]);

/** Set the org's plan + subscription status (shared by real + mock upgrade). */
async function applyPlan(
  db: import("@shipflow/db").PrismaClient,
  organizationId: string,
  plan: PlanId,
  fields: {
    status?: "ACTIVE" | "CANCELED";
    razorpaySubscriptionId?: string | null;
    razorpayPlanId?: string | null;
  } = {},
) {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const status = fields.status ?? (plan === "FREE" ? "CANCELED" : "ACTIVE");

  await db.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      plan,
      status,
      razorpaySubscriptionId: fields.razorpaySubscriptionId,
      razorpayPlanId: fields.razorpayPlanId,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan,
      status,
      ...(fields.razorpaySubscriptionId !== undefined
        ? { razorpaySubscriptionId: fields.razorpaySubscriptionId }
        : {}),
      ...(fields.razorpayPlanId !== undefined
        ? { razorpayPlanId: fields.razorpayPlanId }
        : {}),
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });
  await db.organization.update({ where: { id: organizationId }, data: { plan } });
}

export const billingRouter = router({
  /** All plans, the org's current plan, and whether real checkout is live. */
  plans: orgProcedure.query(async ({ ctx }) => {
    const current = await getOrgPlan(ctx.organizationId);
    return {
      current,
      razorpayLive: isRazorpayConfigured(),
      plans: PLAN_ORDER.map((id) => ({
        id,
        name: PLANS[id].name,
        priceLabel: PLANS[id].priceLabel,
        description: PLANS[id].description,
        features: PLANS[id].features,
        premium: PLANS[id].premium,
        isCurrent: id === current,
      })),
    };
  }),

  /** Usage vs limits, for the dashboard bars. */
  usage: orgProcedure.query(async ({ ctx }) => {
    const [plan, usage] = await Promise.all([
      getOrgPlan(ctx.organizationId),
      getAllUsage(ctx.organizationId),
    ]);
    return { plan, usage };
  }),

  /**
   * Start a real Razorpay subscription checkout. Returns the subscription id +
   * key for Razorpay Checkout on the client. Only when Razorpay is configured.
   */
  createCheckout: roleProcedure("admin")
    .input(z.object({ plan: PAID_PLANS }))
    .mutation(async ({ input }) => {
      if (!isRazorpayConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Razorpay is not configured. Use the mock upgrade instead.",
        });
      }
      const planId = razorpayPlanId(input.plan);
      if (!planId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `No Razorpay plan id configured for ${input.plan}.`,
        });
      }
      const sub = await createSubscription(planId);
      return {
        subscriptionId: sub.id,
        keyId: razorpayKeyId(),
        planLabel: PLANS[input.plan].name,
      };
    }),

  /** Verify a completed Razorpay checkout and upgrade the org. */
  verifyPayment: roleProcedure("admin")
    .input(
      z.object({
        plan: PAID_PLANS,
        paymentId: z.string(),
        subscriptionId: z.string(),
        signature: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ok = verifyPaymentSignature({
        paymentId: input.paymentId,
        subscriptionId: input.subscriptionId,
        signature: input.signature,
      });
      if (!ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payment signature verification failed.",
        });
      }
      await applyPlan(ctx.db, ctx.organizationId, input.plan, {
        status: "ACTIVE",
        razorpaySubscriptionId: input.subscriptionId,
        razorpayPlanId: razorpayPlanId(input.plan) ?? null,
      });
      await ctx.db.auditEvent.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.auth.userId,
          action: "billing.upgraded",
          entityType: "Organization",
          entityId: ctx.organizationId,
          metadata: { plan: input.plan, via: "razorpay" },
        },
      });
      return { ok: true };
    }),

  /**
   * Mock upgrade — activates a paid plan without a real payment. Available
   * when Razorpay isn't configured so billing stays demoable. Guarded to the
   * mock case so it can't be abused in a real deployment.
   */
  mockUpgrade: roleProcedure("admin")
    .input(z.object({ plan: PAID_PLANS }))
    .mutation(async ({ ctx, input }) => {
      if (isRazorpayConfigured()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Razorpay is configured — use real checkout.",
        });
      }
      await applyPlan(ctx.db, ctx.organizationId, input.plan, { status: "ACTIVE" });
      await ctx.db.auditEvent.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.auth.userId,
          action: "billing.upgraded",
          entityType: "Organization",
          entityId: ctx.organizationId,
          metadata: { plan: input.plan, via: "mock" },
        },
      });
      return { ok: true };
    }),

  /** Downgrade to Free (cancel). Webhook also does this for real cancels. */
  cancel: roleProcedure("admin").mutation(async ({ ctx }) => {
    await applyPlan(ctx.db, ctx.organizationId, "FREE", { status: "CANCELED" });
    await ctx.db.auditEvent.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.auth.userId,
        action: "billing.canceled",
        entityType: "Organization",
        entityId: ctx.organizationId,
      },
    });
    return { ok: true };
  }),
});
