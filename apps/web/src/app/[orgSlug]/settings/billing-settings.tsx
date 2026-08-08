"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadRazorpayCheckout } from "@/lib/razorpay";

const METRIC_LABEL: Record<string, string> = {
  repositories: "Repositories",
  ai_review_credits: "AI review credits",
  feature_requests: "Feature requests",
};

export function BillingSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const plans = useQuery(trpc.billing.plans.queryOptions());
  const usage = useQuery(trpc.billing.usage.queryOptions());

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.billing.plans.queryOptions().queryKey,
    });
    queryClient.invalidateQueries({
      queryKey: trpc.billing.usage.queryOptions().queryKey,
    });
  };

  const createCheckout = useMutation(trpc.billing.createCheckout.mutationOptions());
  const verifyPayment = useMutation(
    trpc.billing.verifyPayment.mutationOptions({
      onSuccess: () => {
        toast.success("Upgraded — welcome to the new plan!");
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const mockUpgrade = useMutation(
    trpc.billing.mockUpgrade.mutationOptions({
      onSuccess: () => {
        toast.success("Upgraded (demo mode).");
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const cancel = useMutation(
    trpc.billing.cancel.mutationOptions({
      onSuccess: () => {
        toast.success("Downgraded to Free.");
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  async function upgrade(planId: "PRO" | "SCALE") {
    if (!plans.data?.razorpayLive) {
      mockUpgrade.mutate({ plan: planId });
      return;
    }
    try {
      const { subscriptionId, keyId, planLabel } = await createCheckout.mutateAsync(
        { plan: planId },
      );
      const rzp = await loadRazorpayCheckout();
      const checkout = new rzp({
        key: keyId,
        subscription_id: subscriptionId,
        name: "ShipFlow AI",
        description: `${planLabel} plan`,
        handler: (res: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          verifyPayment.mutate({
            plan: planId,
            paymentId: res.razorpay_payment_id,
            subscriptionId: res.razorpay_subscription_id,
            signature: res.razorpay_signature,
          });
        },
        theme: { color: "#6d5cff" },
      });
      checkout.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    }
  }

  const busy = createCheckout.isPending || mockUpgrade.isPending;
  const current = plans.data?.current ?? "FREE";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="size-4" /> Billing &amp; usage
        </CardTitle>
        <CardDescription>
          You&apos;re on the{" "}
          <span className="font-medium text-foreground">
            {plans.data?.plans.find((p) => p.isCurrent)?.name ?? "Free"}
          </span>{" "}
          plan.
          {plans.data && !plans.data.razorpayLive && (
            <span className="ml-1 text-xs">
              (demo billing — Razorpay keys not set)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Usage bars */}
        <div className="space-y-3">
          {usage.data?.usage.map((u) => {
            const unlimited = u.limit === -1;
            const pct = unlimited
              ? 0
              : Math.min(100, Math.round((u.used / Math.max(1, u.limit)) * 100));
            const over = !unlimited && u.used >= u.limit;
            return (
              <div key={u.metric} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{METRIC_LABEL[u.metric] ?? u.metric}</span>
                  <span className="text-muted-foreground">
                    {u.used} / {unlimited ? "∞" : u.limit}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: unlimited ? "8%" : `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Plan cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.data?.plans.map((p) => (
            <div
              key={p.id}
              className={`flex flex-col rounded-xl border p-4 ${
                p.isCurrent ? "border-primary ring-1 ring-primary" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                {p.premium && <Sparkles className="size-4 text-primary" />}
              </div>
              <p className="mt-1 text-2xl font-semibold">
                {p.priceLabel}
                <span className="text-sm font-normal text-muted-foreground">
                  {p.id === "FREE" ? "" : "/mo"}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                {p.features.map((f, i) => (
                  <li key={i} className="flex gap-2 text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                {p.isCurrent ? (
                  <Badge variant="success" className="w-full justify-center py-1.5">
                    Current plan
                  </Badge>
                ) : p.id === "FREE" ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => cancel.mutate()}
                    disabled={cancel.isPending || current === "FREE"}
                  >
                    Downgrade
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => upgrade(p.id as "PRO" | "SCALE")}
                    disabled={busy}
                  >
                    {busy && <Loader2 className="animate-spin" />}
                    Upgrade
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
