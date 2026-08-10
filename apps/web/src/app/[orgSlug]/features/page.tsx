import Link from "next/link";
import { getServerApi } from "@/trpc/server";
import { Card } from "@/components/ui/card";
import { NewRequestDialog } from "./_components/new-request-dialog";
import { StatusBadge } from "./_components/status-badge";

export default async function FeaturesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const api = await getServerApi();
  const features = await api.featureRequest.list();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-1.5">Requests</p>
          <h1 className="text-2xl font-semibold tracking-tight">Feature requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Idea → PRD → Tasks → Review → Ship.
          </p>
        </div>
        <NewRequestDialog orgSlug={orgSlug} />
      </div>

      {features.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="font-medium">No feature requests yet</p>
          <p className="text-sm text-muted-foreground">
            Submit your first request and the AI will get to work.
          </p>
        </Card>
      ) : (
        <Card className="divide-y">
          {features.map((f) => (
            <Link
              key={f.id}
              href={`/${orgSlug}/features/${f.id}`}
              className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-accent/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{f.title}</p>
                <p className="text-xs text-muted-foreground">
                  {f.project?.name} · {f.source.toLowerCase()} ·{" "}
                  {new Date(f.createdAt).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge status={f.status} />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
