import { prisma } from "@shipflow/db";
import { assessReleaseReadiness, type Prd } from "@shipflow/ai";
import { inngest } from "../client";
import { startRun, markStep, completeRun, failRun } from "../progress";

/**
 * Release-readiness brief for the human approver (spec Phase 5). Gathers the
 * PRD, tasks, PRs, AI review history and unresolved issues, then stores an
 * advisory verdict. A human still makes the final call.
 */
export const releaseReadiness = inngest.createFunction(
  { id: "release-readiness", name: "Release: readiness check" },
  { event: "release.readiness.requested" },
  async ({ event, step }) => {
    const { featureRequestId, workflowRunId } = event.data;

    await step.run("start", () =>
      startRun(workflowRunId, [
        { step: "gather", label: "Gathering PRD, PRs and review history", status: "pending" },
        { step: "assess", label: "Assessing release readiness", status: "pending" },
        { step: "save", label: "Saving assessment", status: "pending" },
      ]),
    );

    try {
      const data = await step.run("gather", async () => {
        await markStep(workflowRunId, "gather", "running");
        const feature = await prisma.featureRequest.findUniqueOrThrow({
          where: { id: featureRequestId },
          include: {
            prd: true,
            tasks: true,
            pullRequests: {
              include: {
                reviews: {
                  orderBy: { createdAt: "desc" },
                  include: { issues: true },
                },
              },
            },
          },
        });
        await markStep(workflowRunId, "gather", "done");
        return feature;
      });

      if (!data.prd) throw new Error("This feature has no PRD.");

      const allReviews = data.pullRequests.flatMap((p) => p.reviews);
      const latestReview = allReviews[0];
      const openIssues = allReviews
        .flatMap((r) => r.issues)
        .filter((i) => !i.resolved);

      const prd: Prd = {
        problemStatement: data.prd.problemStatement,
        goals: data.prd.goals as string[],
        nonGoals: data.prd.nonGoals as string[],
        userStories: data.prd.userStories as Prd["userStories"],
        acceptanceCriteria: data.prd.acceptanceCriteria as Prd["acceptanceCriteria"],
        edgeCases: data.prd.edgeCases as string[],
        successMetrics: data.prd.successMetrics as string[],
      };

      const assessment = await step.run("assess", async () => {
        await markStep(workflowRunId, "assess", "running");
        const a = await assessReleaseReadiness({
          featureTitle: data.title,
          prd,
          tasks: data.tasks.map((t) => ({ title: t.title, status: t.status })),
          pullRequests: data.pullRequests.map((p) => ({
            number: p.number,
            title: p.title,
            state: p.state,
          })),
          reviews: allReviews.map((r) => ({
            verdict: r.verdict,
            summary: r.summary,
            createdAt: String(r.createdAt),
            blockingCount: r.issues.filter((i) => i.severity === "BLOCKING").length,
            nonBlockingCount: r.issues.filter((i) => i.severity === "NON_BLOCKING")
              .length,
          })),
          openIssues: openIssues.map((i) => ({
            severity: i.severity,
            category: i.category,
            title: i.title,
            rationale: i.rationale,
          })),
          acceptanceCoverage:
            (latestReview?.acceptanceCoverage as
              | { id: string; status: string; evidence: string }[]
              | null) ?? [],
        });
        await markStep(workflowRunId, "assess", "done");
        return a;
      });

      await step.run("save", async () => {
        await markStep(workflowRunId, "save", "running");
        await prisma.featureRequest.update({
          where: { id: featureRequestId },
          data: { releaseReadiness: assessment },
        });
        await markStep(workflowRunId, "save", "done");
      });

      await step.run("complete", () => completeRun(workflowRunId));
      return { verdict: assessment.verdict };
    } catch (err) {
      await failRun(workflowRunId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  },
);
