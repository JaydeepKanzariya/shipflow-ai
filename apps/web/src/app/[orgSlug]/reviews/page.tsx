import Link from "next/link";
import { Bot, GitPullRequest } from "lucide-react";
import { getServerApi } from "@/trpc/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const VERDICT: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  APPROVED: { label: "Approved", variant: "success" },
  CHANGES_REQUESTED: { label: "Changes requested", variant: "destructive" },
  COMMENTED: { label: "Commented", variant: "default" },
  PENDING: { label: "Pending", variant: "muted" },
};

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const api = await getServerApi();
  const reviews = await api.review.recent();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every AI review across your pull requests, newest first.
        </p>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Bot className="size-6 text-muted-foreground" />
            <p className="font-medium">No reviews yet</p>
            <p className="text-sm text-muted-foreground">
              Link a pull request to a feature and run an AI review from the
              feature page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="divide-y">
          {reviews.map((r) => {
            const v = VERDICT[r.verdict] ?? VERDICT.PENDING!;
            const featureId = r.pr.featureRequest?.id;
            const inner = (
              <div className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <GitPullRequest className="size-4 text-muted-foreground" />
                    <span className="truncate font-medium">
                      #{r.pr.number} {r.pr.title}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.pr.repository.fullName}
                    {r.pr.featureRequest ? ` · ${r.pr.featureRequest.title}` : ""} ·{" "}
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                  {r.summary && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {r.summary}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={v.variant}>{v.label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {r.blocking} blocking · {r.nonBlocking} non-blocking
                  </span>
                </div>
              </div>
            );
            return featureId ? (
              <Link
                key={r.id}
                href={`/${orgSlug}/features/${featureId}`}
                className="block transition-colors hover:bg-accent/40"
              >
                {inner}
              </Link>
            ) : (
              <div key={r.id}>{inner}</div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
