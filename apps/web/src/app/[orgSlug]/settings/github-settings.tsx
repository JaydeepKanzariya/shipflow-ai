"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Github, Loader2, Plus, Trash2, ExternalLink } from "lucide-react";
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

export function GithubSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const status = useQuery(trpc.github.status.queryOptions());
  const installUrl = useQuery(
    trpc.github.installUrl.queryOptions(undefined, {
      enabled: !!status.data?.appConfigured,
      retry: false,
    }),
  );
  const available = useQuery(
    trpc.github.availableRepos.queryOptions(undefined, {
      enabled: !!status.data?.connected,
      retry: false,
    }),
  );
  const connected = useQuery(trpc.github.connectedRepos.queryOptions());
  const projects = useQuery(trpc.project.list.queryOptions());
  const ensureDefault = useMutation(trpc.project.ensureDefault.mutationOptions());

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.github.connectedRepos.queryOptions().queryKey,
    });
    queryClient.invalidateQueries({
      queryKey: trpc.github.availableRepos.queryOptions().queryKey,
    });
  };

  const connectRepo = useMutation(
    trpc.github.connectRepo.mutationOptions({
      onSuccess: () => {
        toast.success("Repository connected — analyzing it now.");
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const disconnectRepo = useMutation(
    trpc.github.disconnectRepo.mutationOptions({
      onSuccess: invalidate,
      onError: (e) => toast.error(e.message),
    }),
  );

  async function handleConnect(repo: {
    owner: string;
    name: string;
    fullName: string;
    githubRepoId: string;
    defaultBranch: string;
    private: boolean;
  }) {
    let projectId = projects.data?.[0]?.id;
    if (!projectId) projectId = (await ensureDefault.mutateAsync()).id;
    connectRepo.mutate({ projectId, ...repo });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Github className="size-4" /> GitHub
        </CardTitle>
        <CardDescription>
          Connect repositories so pull requests are tracked and reviewed
          against your PRDs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Install state */}
        {status.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking status…</p>
        ) : !status.data?.appConfigured ? (
          <p className="text-sm text-muted-foreground">
            The GitHub App isn&apos;t configured yet (missing
            <code className="mx-1">NEXT_PUBLIC_GITHUB_APP_SLUG</code> /
            app credentials). See docs/M5-PLAN.md for setup.
          </p>
        ) : !status.data.connected ? (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Install the ShipFlow GitHub App</p>
              <p className="text-xs text-muted-foreground">
                Grants read access to code and read/write to pull requests.
              </p>
            </div>
            <Button asChild disabled={!installUrl.data}>
              <a href={installUrl.data?.url ?? "#"}>
                <Github /> Connect GitHub
              </a>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="success">Installed</Badge>
            <span className="text-muted-foreground">
              installation #{status.data.installationId}
            </span>
            <Button asChild size="sm" variant="ghost" className="ml-auto">
              <a href={installUrl.data?.url ?? "#"}>
                Manage <ExternalLink className="size-3" />
              </a>
            </Button>
          </div>
        )}

        {/* Connected repos */}
        {(connected.data?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Connected repositories
            </h3>
            {connected.data!.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.project?.name} · {r.defaultBranch}
                    {r.latestAnalysis
                      ? ` · analyzed ${new Date(
                          r.latestAnalysis.createdAt,
                        ).toLocaleDateString()}`
                      : " · analysis pending…"}
                  </p>
                  {r.latestAnalysis && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {r.latestAnalysis.summary}
                    </p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => disconnectRepo.mutate({ id: r.id })}
                  aria-label="Disconnect repository"
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Available repos */}
        {status.data?.connected && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Available repositories
            </h3>
            {available.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading repos…</p>
            ) : available.isError ? (
              <p className="text-sm text-destructive">{available.error.message}</p>
            ) : (
              available.data
                ?.filter((r) => !r.connected)
                .map((r) => (
                  <div
                    key={r.githubRepoId}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.private ? "private" : "public"} · {r.defaultBranch}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConnect(r)}
                      disabled={connectRepo.isPending}
                    >
                      {connectRepo.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Plus />
                      )}
                      Connect
                    </Button>
                  </div>
                ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
