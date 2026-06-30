import { getServerApi } from "@/trpc/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PHASES = [
  { n: 1, title: "Product Discovery", desc: "Clarify the request, generate a PRD." },
  { n: 2, title: "Planning", desc: "Break the PRD into tasks on a Kanban board." },
  { n: 3, title: "Development", desc: "Connect a repo; track pull requests." },
  { n: 4, title: "AI Review", desc: "Review PRs against requirements; loop on fixes." },
  { n: 5, title: "Human Approval", desc: "Verify everything, approve the release." },
];

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const api = await getServerApi();
  const org = await api.organization.bySlug({ slug: orgSlug });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="mt-1 text-muted-foreground">
          Your workspace is ready. Here&apos;s the delivery workflow ShipFlow runs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PHASES.map((p) => (
          <Card key={p.n}>
            <CardHeader>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-sm font-semibold text-primary">
                {p.n}
              </div>
              <CardTitle className="mt-2 text-base">{p.title}</CardTitle>
              <CardDescription>{p.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              Coming next
            </CardTitle>
            <CardDescription>
              Feature requests, PRD editor, task board, and AI reviews land in
              the upcoming milestones.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Role: <span className="font-medium text-foreground">{org.role}</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
