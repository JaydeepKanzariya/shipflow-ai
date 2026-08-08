import Link from "next/link";
import { FolderKanban, GitBranch } from "lucide-react";
import { getServerApi } from "@/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const api = await getServerApi();
  const [projects, repos, features] = await Promise.all([
    api.project.list(),
    api.github.connectedRepos(),
    api.featureRequest.list(),
  ]);

  const reposByProject = new Map<string, typeof repos>();
  for (const r of repos) {
    const key = r.project?.id ?? "";
    reposByProject.set(key, [...(reposByProject.get(key) ?? []), r]);
  }
  const featureCount = new Map<string, number>();
  for (const f of features) {
    const key = f.project?.id ?? "";
    featureCount.set(key, (featureCount.get(key) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each project groups feature requests and connected repositories.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <FolderKanban className="size-6 text-muted-foreground" />
            <p className="font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground">
              A project is created automatically when you submit your first
              feature request or connect a repository.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => {
            const projectRepos = reposByProject.get(p.id) ?? [];
            return (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  {p.description && (
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-2">
                    <Badge variant="muted">
                      {featureCount.get(p.id) ?? 0} feature
                      {(featureCount.get(p.id) ?? 0) === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="muted">
                      {projectRepos.length} repo
                      {projectRepos.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  {projectRepos.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 text-muted-foreground"
                    >
                      <GitBranch className="size-3.5" />
                      <span className="truncate">{r.fullName}</span>
                    </div>
                  ))}
                  <Link
                    href={`/${orgSlug}/features`}
                    className="inline-block text-xs text-primary hover:underline"
                  >
                    View feature requests →
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
