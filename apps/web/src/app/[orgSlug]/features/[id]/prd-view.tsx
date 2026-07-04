"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UserStory = { as: string; want: string; soThat: string };
type AC = { id: string; text: string };

type Prd = {
  problemStatement: string;
  goals: unknown;
  nonGoals: unknown;
  userStories: unknown;
  acceptanceCriteria: unknown;
  edgeCases: unknown;
  successMetrics: unknown;
  approvedAt: Date | string | null;
};

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

export function PrdView({
  featureId,
  prd,
  approved,
  onChanged,
}: {
  featureId: string;
  prd: Prd;
  approved: boolean;
  onChanged: () => void;
}) {
  const trpc = useTRPC();
  const approve = useMutation(
    trpc.prd.approve.mutationOptions({
      onSuccess: () => {
        toast.success("PRD approved.");
        onChanged();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const goals = asStrings(prd.goals);
  const nonGoals = asStrings(prd.nonGoals);
  const edgeCases = asStrings(prd.edgeCases);
  const successMetrics = asStrings(prd.successMetrics);
  const userStories = (Array.isArray(prd.userStories) ? prd.userStories : []) as UserStory[];
  const acceptance = (Array.isArray(prd.acceptanceCriteria) ? prd.acceptanceCriteria : []) as AC[];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Product Requirements Document</CardTitle>
        {approved ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="size-3" /> Approved
          </Badge>
        ) : (
          <Button
            size="sm"
            onClick={() => approve.mutate({ featureRequestId: featureId })}
            disabled={approve.isPending}
          >
            {approve.isPending && <Loader2 className="animate-spin" />}
            Approve PRD
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <Section title="Problem statement">
          <p className="text-muted-foreground">{prd.problemStatement}</p>
        </Section>

        <div className="grid gap-6 sm:grid-cols-2">
          <Section title="Goals">
            <List items={goals} />
          </Section>
          <Section title="Non-goals">
            <List items={nonGoals} />
          </Section>
        </div>

        <Section title="User stories">
          <ul className="space-y-2">
            {userStories.map((s, i) => (
              <li key={i} className="text-muted-foreground">
                As <span className="text-foreground">{s.as}</span>, I want{" "}
                <span className="text-foreground">{s.want}</span> so that{" "}
                <span className="text-foreground">{s.soThat}</span>.
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Acceptance criteria">
          <ul className="space-y-1.5">
            {acceptance.map((ac) => (
              <li key={ac.id} className="flex gap-2 text-muted-foreground">
                <Badge variant="outline" className="shrink-0 font-mono">
                  {ac.id}
                </Badge>
                <span>{ac.text}</span>
              </li>
            ))}
          </ul>
        </Section>

        <div className="grid gap-6 sm:grid-cols-2">
          <Section title="Edge cases">
            <List items={edgeCases} />
          </Section>
          <Section title="Success metrics">
            <List items={successMetrics} />
          </Section>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (items.length === 0)
    return <p className="text-muted-foreground/60">—</p>;
  return (
    <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
