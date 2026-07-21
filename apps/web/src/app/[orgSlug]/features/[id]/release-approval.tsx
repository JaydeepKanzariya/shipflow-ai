"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  Rocket,
  ShieldCheck,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const READINESS: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  READY: { label: "Ready to ship", variant: "success" },
  READY_WITH_RISKS: { label: "Ready with risks", variant: "warning" },
  NOT_READY: { label: "Not ready", variant: "destructive" },
};

const CHECK_ICON = {
  PASS: { icon: CheckCircle2, className: "text-green-500" },
  WARN: { icon: CircleAlert, className: "text-yellow-500" },
  FAIL: { icon: XCircle, className: "text-destructive" },
} as const;

type Readiness = {
  verdict: string;
  summary: string;
  checks: { name: string; status: keyof typeof CHECK_ICON; detail: string }[];
  outstandingRisks: string[];
};

export function ReleaseApproval({ featureId }: { featureId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const overviewOpts = trpc.release.overview.queryOptions({
    featureRequestId: featureId,
  });
  const overview = useQuery(overviewOpts);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: overviewOpts.queryKey });
    queryClient.invalidateQueries({
      queryKey: trpc.featureRequest.byId.queryOptions({ id: featureId }).queryKey,
    });
  };

  const runReadiness = useMutation(
    trpc.release.runReadiness.mutationOptions({
      onSuccess: () => {
        toast.success("Assessing release readiness…");
        setTimeout(invalidate, 4000);
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const approve = useMutation(
    trpc.release.approve.mutationOptions({
      onSuccess: () => {
        toast.success("Release approved.");
        setNote("");
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const reject = useMutation(
    trpc.release.reject.mutationOptions({
      onSuccess: () => {
        toast.success("Sent back for fixes.");
        setNote("");
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const ship = useMutation(
    trpc.release.ship.mutationOptions({
      onSuccess: () => {
        toast.success("Shipped 🚀");
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const d = overview.data;
  if (overview.isLoading || !d) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading release status…
        </CardContent>
      </Card>
    );
  }

  const readiness = d.readiness as Readiness | null;
  const shipped = d.status === "SHIPPED";
  const approved = d.status === "APPROVED" || shipped;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" /> Approval &amp; release
        </CardTitle>
        <div className="flex items-center gap-2">
          {readiness && (
            <Badge variant={READINESS[readiness.verdict]?.variant ?? "muted"}>
              {READINESS[readiness.verdict]?.label ?? readiness.verdict}
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => runReadiness.mutate({ featureRequestId: featureId })}
            disabled={runReadiness.isPending}
          >
            {runReadiness.isPending && <Loader2 className="animate-spin" />}
            {readiness ? "Re-check" : "Check readiness"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 text-sm">
        {/* Evidence the reviewer verifies (spec Phase 5) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Tasks" value={`${d.tasks.length}`} />
          <Fact label="Pull requests" value={`${d.pullRequests.length}`} />
          <Fact label="AI reviews" value={`${d.reviewCount}`} />
          <Fact
            label="Open blocking"
            value={`${d.blockingCount}`}
            bad={d.blockingCount > 0}
          />
        </div>

        {readiness ? (
          <>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {readiness.summary}
            </p>
            {readiness.checks?.length > 0 && (
              <div className="space-y-1.5">
                {readiness.checks.map((c, i) => {
                  const meta = CHECK_ICON[c.status] ?? CHECK_ICON.WARN;
                  const Icon = meta.icon;
                  return (
                    <div key={i} className="flex gap-2">
                      <Icon className={`mt-0.5 size-4 shrink-0 ${meta.className}`} />
                      <div>
                        <span className="font-medium">{c.name}</span>{" "}
                        <span className="text-muted-foreground">— {c.detail}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {readiness.outstandingRisks?.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Outstanding risks
                </h3>
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                  {readiness.outstandingRisks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            Run a readiness check to summarize the PRD, tasks, pull requests and
            AI review history before deciding.
          </p>
        )}

        {d.blockingCount > 0 && !approved && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              {d.blockingCount} unresolved blocking issue
              {d.blockingCount > 1 ? "s" : ""}. Resolve them, or approve with an
              explicit override reason below.
            </span>
          </p>
        )}

        {/* Decision */}
        {shipped ? (
          <p className="flex items-center gap-2 text-green-500">
            <Rocket className="size-4" /> Shipped
            {d.shippedAt ? ` on ${new Date(d.shippedAt).toLocaleString()}` : ""}.
          </p>
        ) : approved ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-green-500">
              <CheckCircle2 className="size-4" /> Approved
              {d.approvedBy?.name ? ` by ${d.approvedBy.name}` : ""}
              {d.approvedAt ? ` on ${new Date(d.approvedAt).toLocaleString()}` : ""}.
            </p>
            {d.decisionNote && (
              <p className="text-muted-foreground">{d.decisionNote}</p>
            )}
            <Button
              onClick={() => ship.mutate({ featureRequestId: featureId })}
              disabled={ship.isPending}
            >
              {ship.isPending && <Loader2 className="animate-spin" />}
              <Rocket /> Mark as shipped
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="note">
                Decision note{" "}
                <span className="text-muted-foreground">
                  (required to reject or override)
                </span>
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Why are you approving or rejecting this release?"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  approve.mutate({
                    featureRequestId: featureId,
                    note: note || undefined,
                    overrideBlocking: d.blockingCount > 0,
                  })
                }
                disabled={approve.isPending}
              >
                {approve.isPending && <Loader2 className="animate-spin" />}
                <CheckCircle2 />
                {d.blockingCount > 0 ? "Approve (override)" : "Approve release"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  reject.mutate({ featureRequestId: featureId, note })
                }
                disabled={reject.isPending || !note.trim()}
              >
                {reject.isPending && <Loader2 className="animate-spin" />}
                <XCircle /> Send back for fixes
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({
  label,
  value,
  bad,
}: {
  label: string;
  value: string;
  bad?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${bad ? "text-destructive" : ""}`}>
        {value}
      </p>
    </div>
  );
}
