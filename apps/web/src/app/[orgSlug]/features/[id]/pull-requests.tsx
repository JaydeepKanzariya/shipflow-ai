"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitPullRequest, Link2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiReview } from "./ai-review";

const PR_BADGE: Record<string, "success" | "muted" | "default"> = {
  OPEN: "default",
  MERGED: "success",
  CLOSED: "muted",
};

export function PullRequests({ featureId }: { featureId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const linkedOpts = trpc.pullRequest.byFeature.queryOptions({
    featureRequestId: featureId,
  });
  const linked = useQuery(linkedOpts);
  const unlinked = useQuery(trpc.pullRequest.unlinked.queryOptions());

  const link = useMutation(
    trpc.pullRequest.link.mutationOptions({
      onSuccess: () => {
        toast.success("Pull request linked.");
        queryClient.invalidateQueries({ queryKey: linkedOpts.queryKey });
        queryClient.invalidateQueries({
          queryKey: trpc.pullRequest.unlinked.queryOptions().queryKey,
        });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitPullRequest className="size-4" /> Pull requests
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {linked.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (linked.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pull requests linked yet. Open a PR whose branch name or
            description contains this feature&apos;s id (
            <code className="text-xs">{featureId}</code>) to auto-link it — or
            link one below.
          </p>
        ) : (
          <div className="space-y-4">
            {linked.data!.map((pr) => (
              <div key={pr.id} className="space-y-3">
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      #{pr.number} {pr.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pr.repository.fullName} · {pr.branch} → {pr.baseBranch}
                      {pr.authorLogin ? ` · @${pr.authorLogin}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={PR_BADGE[pr.state] ?? "muted"}>
                      {pr.state.toLowerCase()}
                    </Badge>
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </div>
                </a>
                <AiReview pullRequestId={pr.id} prNumber={pr.number} />
              </div>
            ))}
          </div>
        )}

        {(unlinked.data?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Unlinked pull requests
            </h3>
            {unlinked.data!.map((pr) => (
              <div
                key={pr.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    #{pr.number} {pr.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pr.repository.fullName}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    link.mutate({ id: pr.id, featureRequestId: featureId })
                  }
                  disabled={link.isPending}
                >
                  <Link2 /> Link
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
