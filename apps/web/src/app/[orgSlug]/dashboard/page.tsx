import Link from "next/link";
import { ArrowRight, GitPullRequest, Inbox, Rocket, Sparkles } from "lucide-react";
import { getServerApi } from "@/trpc/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "../features/_components/status-badge";
import { STAGES, stageIndex } from "@/lib/pipeline";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const api = await getServerApi();
  const [org, features, reviews, repos] = await Promise.all([
    api.organization.bySlug({ slug: orgSlug }),
    api.featureRequest.list(),
    api.review.recent(),
    api.github.connectedRepos(),
  ]);

  const shipped = features.filter((f) => f.status === "SHIPPED").length;
  const inFlight = features.filter(
    (f) => f.status !== "SHIPPED" && f.status !== "REJECTED",
  ).length;

  // Distribution of in-flight features across the pipeline stages.
  const dist = STAGES.map((s) => ({
    ...s,
    count: features.filter((f) => stageIndex(f.status) === STAGES.indexOf(s)).length,
  }));
  const maxDist = Math.max(1, ...dist.map((d) => d.count));

  const recent = features.slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-1.5">Workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {org.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything in flight, from idea to shipped.
          </p>
        </div>
        <Button asChild>
          <Link href={`/${orgSlug}/features`}>
            <Sparkles /> New request
          </Link>
        </Button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Inbox} label="Feature requests" value={features.length} />
        <Stat icon={ArrowRight} label="In flight" value={inFlight} accent="--brand-accent" />
        <Stat icon={GitPullRequest} label="AI reviews" value={reviews.length} />
        <Stat icon={Rocket} label="Shipped" value={shipped} accent="--stage-shipped" />
      </div>

      {/* Pipeline distribution */}
      <Card>
        <CardContent className="p-5">
          <p className="eyebrow mb-4">Pipeline</p>
          {inFlight === 0 && shipped === 0 ? (
            <p className="text-sm text-muted-foreground">
              No features yet. Submit your first request to see it move through
              the pipeline.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
              {dist.map((d) => (
                <div key={d.key} className="flex flex-col items-center gap-2">
                  <div className="flex h-20 w-full items-end justify-center">
                    <div
                      className="w-full max-w-9 rounded-md transition-all"
                      style={{
                        height: `${Math.max(6, (d.count / maxDist) * 100)}%`,
                        backgroundColor:
                          d.count > 0
                            ? `var(${d.colorVar})`
                            : "color-mix(in oklch, var(--muted-foreground) 20%, transparent)",
                      }}
                    />
                  </div>
                  <span className="font-mono text-sm font-semibold">{d.count}</span>
                  <span className="text-center text-[10px] leading-tight text-muted-foreground">
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent features */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">Recent features</p>
          <Link
            href={`/${orgSlug}/features`}
            className="text-xs text-primary hover:underline"
          >
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="font-medium">No feature requests yet</p>
              <p className="text-sm text-muted-foreground">
                Submit one and the AI will draft a PRD to get things moving.
              </p>
              <Button asChild className="mt-2">
                <Link href={`/${orgSlug}/features`}>Create a request</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {recent.map((f) => (
              <Link
                key={f.id}
                href={`/${orgSlug}/features/${f.id}`}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-accent/30"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.project?.name} · {new Date(f.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={f.status} />
              </Link>
            ))}
          </Card>
        )}
      </div>

      {repos.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {repos.length} repositor{repos.length === 1 ? "y" : "ies"} connected ·{" "}
          <Link href={`/${orgSlug}/settings`} className="text-primary hover:underline">
            manage
          </Link>
        </p>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent = "--primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <span
            className="flex size-8 items-center justify-center rounded-lg"
            style={{
              backgroundColor: `color-mix(in oklch, var(${accent}) 15%, transparent)`,
              color: `var(${accent})`,
            }}
          >
            <Icon className="size-4" />
          </span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
