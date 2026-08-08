import { prisma } from "@shipflow/db";
import { verifyWebhookSignature } from "@shipflow/billing";

/**
 * Razorpay webhook receiver. Verifies the HMAC-SHA256 signature over the RAW
 * body, then keeps the org's Subscription + plan in sync with Razorpay
 * (webhooks are the source of truth, not just the client callback).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    event?: string;
    payload?: {
      subscription?: { entity?: { id?: string; status?: string } };
    };
  };

  const event = payload.event ?? "";
  const sub = payload.payload?.subscription?.entity;

  try {
    if (sub?.id) {
      const record = await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId: sub.id },
        select: { id: true, organizationId: true, plan: true },
      });
      if (record) {
        switch (event) {
          case "subscription.activated":
          case "subscription.charged":
            await setStatus(record.organizationId, "ACTIVE", record.plan);
            break;
          case "subscription.halted":
          case "subscription.pending":
            await prisma.subscription.update({
              where: { id: record.id },
              data: { status: "PAST_DUE" },
            });
            break;
          case "subscription.cancelled":
          case "subscription.completed":
            await setStatus(record.organizationId, "CANCELED", "FREE");
            break;
          default:
            break;
        }
      }
    }
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[razorpay-webhook] error:", err);
    return new Response("Handler error", { status: 500 });
  }
}

async function setStatus(
  organizationId: string,
  status: "ACTIVE" | "CANCELED",
  plan: string,
) {
  await prisma.subscription.update({
    where: { organizationId },
    data: { status },
  });
  // On cancel, drop the org to the free plan.
  if (status === "CANCELED") {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { plan: "FREE" },
    });
  } else {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { plan: plan as "FREE" | "PRO" | "SCALE" },
    });
  }
}
