"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "../_components/status-badge";
import { PrdView } from "./prd-view";
import { TaskBoard } from "./task-board";
import { PullRequests } from "./pull-requests";
import { ReleaseApproval } from "./release-approval";

type ProgressStep = {
  step: string;
  label: string;
  status: "pending" | "running" | "done" | "failed";
};

// Statuses where an async workflow is likely in flight → poll for updates.
// PRD_APPROVED: task-generation workflow runs right after PRD approval.
const ACTIVE = new Set(["DISCOVERY", "PRD_APPROVED"]);

// Feature has a task plan to show (tasks generated at/after PRD approval).
const HAS_TASKS = new Set([
  "PRD_APPROVED",
  "TASKS_READY",
  "IN_DEVELOPMENT",
  "IN_AI_REVIEW",
  "FIX_NEEDED",
  "READY_FOR_APPROVAL",
  "APPROVED",
  "SHIPPED",
]);

// The release gate appears once the work is under review or awaiting sign-off.
const AT_RELEASE_STAGE = new Set([
  "IN_AI_REVIEW",
  "FIX_NEEDED",
  "READY_FOR_APPROVAL",
  "APPROVED",
  "SHIPPED",
]);

export function FeatureDetail({ featureId }: { featureId: string }) {
  const router = useRouter();
  const trpc = useTRPC();

  const featureQuery = useQuery(
    trpc.featureRequest.byId.queryOptions(
      { id: featureId },
      {
        refetchInterval: (q) =>
          q.state.data && ACTIVE.has(q.state.data.status) ? 2000 : false,
      },
    ),
  );

  const feature = featureQuery.data;

  if (featureQuery.isLoading || !feature) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const latestRun = feature.workflowRuns[0];
  const clarifyingQA = feature.clarifyingQA as
    | { questions?: { id: string; question: string; why: string }[] }
    | null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{feature.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {feature.project?.name} · {feature.source.toLowerCase()}
          </p>
        </div>
        <StatusBadge status={feature.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
          {feature.rawText}
        </CardContent>
      </Card>

      {/* Live workflow progress */}
      {latestRun &&
        (latestRun.state === "RUNNING" || latestRun.state === "QUEUED") && (
          <WorkflowProgress run={latestRun} />
        )}

      {/* Educate / rejected */}
      {feature.status === "REJECTED" && (
        <EducatePanel
          featureId={featureId}
          note={feature.decisionNote}
          hasPrd={!!feature.prd}
          onChanged={() => featureQuery.refetch()}
        />
      )}

      {/* Clarifying questions */}
      {feature.status === "CLARIFYING" && clarifyingQA?.questions && (
        <ClarifyPanel
          featureId={featureId}
          questions={clarifyingQA.questions}
          onSubmitted={() => {
            router.refresh();
            featureQuery.refetch();
          }}
        />
      )}

      {/* PRD */}
      {feature.prd && (
        <PrdView
          featureId={featureId}
          prd={feature.prd}
          approved={feature.status === "PRD_APPROVED" || !!feature.prd.approvedAt}
          onChanged={() => featureQuery.refetch()}
        />
      )}

      {/* Kanban board (Phase 2 — Planning) */}
      {HAS_TASKS.has(feature.status) && (
        <TaskBoard
          featureId={featureId}
          planApproved={feature.status !== "PRD_APPROVED"}
        />
      )}

      {/* Pull requests (Phase 3 — Development) */}
      {HAS_TASKS.has(feature.status) && <PullRequests featureId={featureId} />}

      {/* Approval & release (Phase 5 — human decides) */}
      {AT_RELEASE_STAGE.has(feature.status) && (
        <ReleaseApproval featureId={featureId} />
      )}
    </div>
  );
}

function WorkflowProgress({
  run,
}: {
  run: { progress: unknown; kind: string; state: string };
}) {
  const steps = (run.progress as ProgressStep[] | null) ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Loader2 className="size-4 animate-spin" /> AI working…
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.length === 0 && (
          <p className="text-sm text-muted-foreground">Queued…</p>
        )}
        {steps.map((s) => (
          <div key={s.step} className="flex items-center gap-2 text-sm">
            {s.status === "done" ? (
              <CheckCircle2 className="size-4 text-green-500" />
            ) : s.status === "running" ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : s.status === "failed" ? (
              <XCircle className="size-4 text-destructive" />
            ) : (
              <Circle className="size-4 text-muted-foreground" />
            )}
            <span
              className={
                s.status === "pending" ? "text-muted-foreground" : "text-foreground"
              }
            >
              {s.label}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ClarifyPanel({
  featureId,
  questions,
  onSubmitted,
}: {
  featureId: string;
  questions: { id: string; question: string; why: string }[];
  onSubmitted: () => void;
}) {
  const trpc = useTRPC();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const submit = useMutation(
    trpc.featureRequest.submitAnswers.mutationOptions({
      onSuccess: () => {
        toast.success("Answers submitted — generating the PRD.");
        onSubmitted();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit.mutate({
      id: featureId,
      answers: questions.map((q) => ({
        question: q.question,
        answer: answers[q.id] ?? "",
      })),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">The AI needs a bit more context</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <Label>{q.question}</Label>
              <p className="text-xs text-muted-foreground">{q.why}</p>
              <Textarea
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                }
                rows={2}
                required
              />
            </div>
          ))}
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="animate-spin" />}
            Submit answers & generate PRD
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EducatePanel({
  featureId,
  note,
  hasPrd,
  onChanged,
}: {
  featureId: string;
  note: string | null;
  hasPrd: boolean;
  onChanged: () => void;
}) {
  const trpc = useTRPC();
  const proceed = useMutation(
    trpc.featureRequest.proceedAnyway.mutationOptions({
      onSuccess: () => {
        toast.success("Proceeding — generating a PRD anyway.");
        onChanged();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <Card className="border-yellow-500/30">
      <CardHeader>
        <CardTitle className="text-base">
          This may already exist — or may not need building
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{note}</p>
        {!hasPrd && (
          <Button
            variant="outline"
            onClick={() => proceed.mutate({ id: featureId })}
            disabled={proceed.isPending}
          >
            {proceed.isPending && <Loader2 className="animate-spin" />}
            Proceed anyway
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
