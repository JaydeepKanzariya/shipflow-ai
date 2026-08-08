import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay is optional. When keys are set we use real Checkout + webhooks;
 * when they're absent the app falls back to a mock upgrade flow so billing is
 * still demoable (see billing.mockUpgrade in the API). This keeps a blocked
 * Razorpay signup from making the billing feature undemonstrable.
 */
export function isRazorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

let _client: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured (RAZORPAY_KEY_ID/SECRET).");
  }
  if (!_client) {
    _client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return _client;
}

export function razorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

/** Create a subscription for a plan; returns the subscription id for Checkout. */
export async function createSubscription(razorpayPlanId: string): Promise<{
  id: string;
  shortUrl?: string;
}> {
  const rzp = getRazorpay();
  const sub = await rzp.subscriptions.create({
    plan_id: razorpayPlanId,
    total_count: 12, // 12 monthly cycles
    customer_notify: 1,
  });
  return { id: sub.id, shortUrl: (sub as { short_url?: string }).short_url };
}

/** Verify the checkout signature: HMAC_SHA256(payment_id|subscription_id). */
export function verifyPaymentSignature(opts: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret)
    .update(`${opts.paymentId}|${opts.subscriptionId}`)
    .digest("hex");
  return safeEqual(expected, opts.signature);
}

/** Verify a webhook: HMAC_SHA256 over the raw body with the webhook secret. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
