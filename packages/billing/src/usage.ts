import { prisma } from "@shipflow/db";
import { PLANS, planLimit, isUnlimited, type Metric, type PlanId } from "./plans";

/** Start of the current monthly usage period (first of the month, UTC). */
function periodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** The org's active plan (from its Subscription, defaulting to FREE). */
export async function getOrgPlan(organizationId: string): Promise<PlanId> {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { plan: true, status: true },
  });
  if (!sub) return "FREE";
  // Only ACTIVE paid subscriptions grant the paid plan.
  if (sub.plan !== "FREE" && sub.status !== "ACTIVE") return "FREE";
  return sub.plan as PlanId;
}

export interface UsageInfo {
  metric: Metric;
  used: number;
  limit: number; // -1 = unlimited
  remaining: number; // Infinity when unlimited
}

/**
 * Current usage for a metric in this period. Repository count is derived live
 * (it's stateful, not incremental); the others use monthly UsageCounter rows.
 */
export async function getUsage(
  organizationId: string,
  metric: Metric,
): Promise<UsageInfo> {
  const plan = await getOrgPlan(organizationId);
  const limit = planLimit(plan, metric);

  let used: number;
  if (metric === "repositories") {
    used = await prisma.repository.count({ where: { organizationId } });
  } else {
    const counter = await prisma.usageCounter.findFirst({
      where: { organizationId, metric, periodStart: periodStart() },
      select: { used: true },
    });
    used = counter?.used ?? 0;
  }

  return {
    metric,
    used,
    limit,
    remaining: isUnlimited(limit) ? Infinity : Math.max(0, limit - used),
  };
}

export class LimitReachedError extends Error {
  constructor(
    public metric: Metric,
    public limit: number,
    public plan: PlanId,
  ) {
    super(`Limit reached for ${metric} on the ${PLANS[plan].name} plan.`);
    this.name = "LimitReachedError";
  }
}

/** Throw LimitReachedError when the org is at/over its limit for a metric. */
export async function assertWithinLimit(
  organizationId: string,
  metric: Metric,
): Promise<void> {
  const usage = await getUsage(organizationId, metric);
  if (isUnlimited(usage.limit)) return;
  if (usage.used >= usage.limit) {
    const plan = await getOrgPlan(organizationId);
    throw new LimitReachedError(metric, usage.limit, plan);
  }
}

/** Increment a monthly-counter metric (not used for repositories). */
export async function incrementUsage(
  organizationId: string,
  metric: Exclude<Metric, "repositories">,
  by = 1,
): Promise<void> {
  const start = periodStart();
  const plan = await getOrgPlan(organizationId);
  await prisma.usageCounter.upsert({
    where: {
      organizationId_metric_periodStart: {
        organizationId,
        metric,
        periodStart: start,
      },
    },
    create: {
      organizationId,
      metric,
      used: by,
      limit: planLimit(plan, metric),
      periodStart: start,
    },
    update: { used: { increment: by } },
  });
}

/** All metrics' usage, for the billing dashboard. */
export async function getAllUsage(organizationId: string): Promise<UsageInfo[]> {
  const metrics: Metric[] = [
    "repositories",
    "ai_review_credits",
    "feature_requests",
  ];
  return Promise.all(metrics.map((m) => getUsage(organizationId, m)));
}
