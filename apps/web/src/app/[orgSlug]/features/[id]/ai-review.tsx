"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const VERDICT: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  APPROVED: { label: "Approved", variant: "success" },
  CHANGES_REQUESTED: { label: "Changes requested", variant: "destructive" },
  COMMENTED: { label: "Commented", variant: "default" },
  PENDING: { label: "Pending", variant: "muted" },
};

const COVERAGE: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  SATISFIED: { icon: CheckCircle2, className: "text-green-500" },
  PARTIAL: { icon: CircleDot, className: "text-yellow-500" },
  NOT_ADDRESSED: { icon: XCircle, className: "text-destructive" },
};

export function AiReview({
  pullRequestId,
  prNumber,
}: {
  pullRequestId: string;
  prNumber: number;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const reviewsOpts = trpc.review.byPullRequest.queryOptions({ pullRequestId });
  const reviews = useQuery({
    ...reviewsOpts,
    // Poll while a review is running so progress lands without a refresh.
    refetchInterval: (q) =>
      q.state.data?.some((r) => r.status === "RUNNING" || r.status === "QUEUED")
        ? 3000
        : false,
  });

  const run = useMutation(
    trpc.review.run.mutationOptions({
      onSuccess: () => {
        toast.success("AI review started…");
        queryClient.invalidateQueries({ queryKey: reviewsOpts.queryKey });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const setResolved = useMutation(
    trpc.review.setIssueResolved.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: reviewsOpts.queryKey }),
      onError: (e) => toast.error(e.message),
    }),
  );

  const latest = reviews.data?.[0];
  const running = latest?.status === "RUNNING" || latest?.status === "QUEUED";
  const blocking = latest?.issues.filter((i) => i.severity === "BLOCKING") ?? [];
  const nonBlocking = latest?.issues.filter((i) => i.severity === "NON_BLOCKING") ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-4" /> AI review · PR #{prNumber}
        </CardTitle>
        <div className="flex items-center gap-2">
          {latest && !running && (
            <Badge variant={VERDICT[latest.verdict]?.variant ?? "muted"}>
              {VERDICT[latest.verdict]?.label ?? latest.verdict}
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => run.mutate({ pullRequestId })}
            disabled={run.isPending || running}
          >
            {(run.isPending || running) && <Loader2 className="animate-spin" />}
            {latest ? "Re-review" : "Review now"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 text-sm">
        {reviews.isLoading ? (
          <p className="text-muted-foreground">Loading reviews…</p>
        ) : !latest ? (
          <p className="text-muted-foreground">
            No AI review yet. Run one to check this pull request against the
            PRD and its acceptance criteria.
          </p>
        ) : running ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Reviewing against the
            requirements…
          </p>
        ) : latest.status === "FAILED" ? (
          <p className="text-destructive">{latest.summary ?? "Review failed."}</p>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {latest.summary}
            </p>

            <AcceptanceCoverage coverage={latest.acceptanceCoverage} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Stat
                label="Blocking"
                value={blocking.length}
                tone={blocking.length ? "bad" : "good"}
              />
              <Stat
                label="Non-blocking"
                value={nonBlocking.length}
                tone="neutral"
              />
            </div>

            {blocking.length > 0 && (
              <IssueGroup
                title="Blocking issues"
                icon={ShieldAlert}
                issues={blocking}
                onToggle={(id, resolved) => setResolved.mutate({ id, resolved })}
              />
            )}
            {nonBlocking.length > 0 && (
              <IssueGroup
                title="Non-blocking issues"
                icon={CircleAlert}
                issues={nonBlocking}
                onToggle={(id, resolved) => setResolved.mutate({ id, resolved })}
              />
            )}
            {latest.issues.length === 0 && (
              <p className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="size-4" /> No issues found — this PR
                satisfies the reviewed criteria.
              </p>
            )}

            {(reviews.data?.length ?? 0) > 1 && (
              <p className="text-xs text-muted-foreground">
                {reviews.data!.length} reviews on this PR (re-reviewed as new
                commits landed).
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

type CoverageRow = { id: string; status: string; evidence: string };

/** Per-acceptance-criterion verdict — the concrete "does it meet the PRD?". */
function AcceptanceCoverage({ coverage }: { coverage: unknown }) {
  const rows = (Array.isArray(coverage) ? coverage : []) as CoverageRow[];
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Acceptance criteria coverage
      </h3>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const meta = COVERAGE[r.status] ?? COVERAGE.NOT_ADDRESSED!;
          const Icon = meta.icon;
          return (
            <div key={r.id} className="flex gap-2">
              <Icon className={`mt-0.5 size-4 shrink-0 ${meta.className}`} />
              <div className="min-w-0">
                <span className="font-mono text-xs text-muted-foreground">
                  {r.id}
                </span>{" "}
                <span className="text-muted-foreground">{r.evidence}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "bad" | "neutral";
}) {
  const color =
    tone === "bad" && value > 0
      ? "text-destructive"
      : tone === "good"
        ? "text-green-500"
        : "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

type Issue = {
  id: string;
  severity: string;
  category: string;
  title: string;
  body: string;
  rationale: string;
  suggestion: string | null;
  filePath: string | null;
  line: number | null;
  resolved: boolean;
};

function IssueGroup({
  title,
  icon: Icon,
  issues,
  onToggle,
}: {
  title: string;
  icon: typeof ShieldAlert;
  issues: Issue[];
  onToggle: (id: string, resolved: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" /> {title}
      </h3>
      {issues.map((i) => (
        <div
          key={i.id}
          className={`rounded-lg border p-3 ${i.resolved ? "opacity-50" : ""}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {i.category}
                </Badge>
                <span className="font-medium">{i.title}</span>
              </div>
              <p className="text-muted-foreground">{i.body}</p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Why: </span>
                {i.rationale}
              </p>
              {i.suggestion && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Suggestion: </span>
                  {i.suggestion}
                </p>
              )}
              {i.filePath && (
                <p className="font-mono text-xs text-muted-foreground">
                  {i.filePath}
                  {i.line ? `:${i.line}` : ""}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggle(i.id, !i.resolved)}
            >
              {i.resolved ? "Reopen" : "Resolve"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
