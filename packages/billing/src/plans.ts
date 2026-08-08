/**
 * Plan definitions and usage limits — the single source of truth for billing
 * gates. Keyed by the Plan enum (FREE/PRO/SCALE). `-1` means unlimited.
 */

export type PlanId = "FREE" | "PRO" | "SCALE";

/** Metrics tracked in UsageCounter and enforced by the API. */
export type Metric = "repositories" | "ai_review_credits" | "feature_requests";

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Monthly price in paise (₹1 = 100 paise). 0 = free. */
  priceInPaise: number;
  priceLabel: string;
  description: string;
  /** Env var holding this plan's Razorpay plan_id (for real checkout). */
  razorpayPlanEnv?: string;
  limits: Record<Metric, number>;
  features: string[];
  premium: boolean;
}

export const PLANS: Record<PlanId, PlanDef> = {
  FREE: {
    id: "FREE",
    name: "Free",
    priceInPaise: 0,
    priceLabel: "₹0",
    description: "Try the full delivery loop on one project.",
    limits: {
      repositories: 1,
      ai_review_credits: 20,
      feature_requests: 10,
    },
    features: [
      "1 repository",
      "20 AI review credits / month",
      "10 feature requests / month",
      "PRD, tasks & AI review",
    ],
    premium: false,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceInPaise: 99900,
    priceLabel: "₹999",
    description: "For teams shipping features continuously.",
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO",
    limits: {
      repositories: 10,
      ai_review_credits: 300,
      feature_requests: -1,
    },
    features: [
      "10 repositories",
      "300 AI review credits / month",
      "Unlimited feature requests",
      "Release-readiness & auto re-review",
    ],
    premium: true,
  },
  SCALE: {
    id: "SCALE",
    name: "Scale",
    priceInPaise: 299900,
    priceLabel: "₹2,999",
    description: "Unlimited delivery across the whole org.",
    razorpayPlanEnv: "RAZORPAY_PLAN_SCALE",
    limits: {
      repositories: -1,
      ai_review_credits: -1,
      feature_requests: -1,
    },
    features: [
      "Unlimited repositories",
      "Unlimited AI review credits",
      "Unlimited feature requests",
      "All premium workflow features",
      "Priority processing",
    ],
    premium: true,
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "PRO", "SCALE"];

export function planLimit(plan: PlanId, metric: Metric): number {
  return PLANS[plan].limits[metric];
}

export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

/** The Razorpay plan_id for a paid plan, if configured in env. */
export function razorpayPlanId(plan: PlanId): string | undefined {
  const env = PLANS[plan].razorpayPlanEnv;
  return env ? process.env[env] : undefined;
}
