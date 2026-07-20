import { prisma } from "@shipflow/db";
import { reviewPullRequest, type Prd, type RepoAnalysis } from "@shipflow/ai";
import { getPrFiles, selectReviewableFiles, postReview } from "@shipflow/github";
import { inngest } from "../client";
import { startRun, markStep, completeRun, failRun } from "../progress";

/**
 * The AI review loop (spec Phase 4). Reviews a PR against its feature's PRD,
 * acceptance criteria, tasks, and repo conventions; stores the review and its
 * issues; posts the feedback to GitHub; and moves the feature to FIX_NEEDED
 * (blocking issues) or READY_FOR_APPROVAL (clean).
 */
export const prAiReview = inngest.createFunction(
  { id: "pr-ai-review", name: "PR: AI review" },
  { event: "pr.review.requested" },
  async ({ event, step }) => {
    const { pullRequestId, workflowRunId } = event.data;

    await step.run("start", () =>
      startRun(workflowRunId, [
        { step: "context", label: "Loading PRD, tasks and repo context", status: "pending" },
        { step: "diff", label: "Fetching pull request diff", status: "pending" },
        { step: "review", label: "Reviewing against requirements", status: "pending" },
        { step: "save", label: "Saving review", status: "pending" },
        { step: "post", label: "Posting comments to GitHub", status: "pending" },
      ]),
    );

    // Create the Review row up-front so the UI can show it as running.
    const reviewId = await step.run("create-review", async () => {
      const r = await prisma.review.create({
        data: { pullRequestId, trigger: "AI", status: "RUNNING" },
        select: { id: true },
      });
      return r.id;
    });

    try {
      const context = await step.run("context", async () => {
        await markStep(workflowRunId, "context", "running");
        const pr = await prisma.pullRequest.findUniqueOrThrow({
          where: { id: pullRequestId },
          include: {
            repository: {
              include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } },
            },
            featureRequest: {
              include: { prd: true, tasks: true },
            },
          },
        });
        // Unresolved issues from the most recent completed review.
        const prior = await prisma.review.findFirst({
          where: { pullRequestId, status: "COMPLETED", id: { not: reviewId } },
          orderBy: { createdAt: "desc" },
          include: { issues: { where: { resolved: false } } },
        });
        await markStep(workflowRunId, "context", "done");
        return { pr, priorIssues: prior?.issues ?? [] };
      });

      const { pr, priorIssues } = context;
      if (!pr.featureRequest?.prd) {
        throw new Error(
          "This pull request isn't linked to a feature with an approved PRD.",
        );
      }
      if (!pr.repository.installationId) {
        throw new Error("Repository has no GitHub installation.");
      }

      const diff = await step.run("diff", async () => {
        await markStep(workflowRunId, "diff", "running");
        const files = await getPrFiles({
          installationId: pr.repository.installationId!,
          owner: pr.repository.owner,
          repo: pr.repository.name,
          pullNumber: pr.number,
        });
        const selected = selectReviewableFiles(files);
        await markStep(workflowRunId, "diff", "done");
        return selected;
      });

      const prdJson = pr.featureRequest.prd;
      const prd: Prd = {
        problemStatement: prdJson.problemStatement,
        goals: prdJson.goals as string[],
        nonGoals: prdJson.nonGoals as string[],
        userStories: prdJson.userStories as Prd["userStories"],
        acceptanceCriteria: prdJson.acceptanceCriteria as Prd["acceptanceCriteria"],
        edgeCases: prdJson.edgeCases as string[],
        successMetrics: prdJson.successMetrics as string[],
      };

      const analysisRow = pr.repository.analyses[0];
      const repoAnalysis = analysisRow
        ? ({
            summary: analysisRow.summary,
            ...(analysisRow.details as object),
          } as RepoAnalysis)
        : null;

      const result = await step.run("review", async () => {
        await markStep(workflowRunId, "review", "running");
        const r = await reviewPullRequest({
          featureTitle: pr.featureRequest!.title,
          prd,
          tasks: pr.featureRequest!.tasks.map((t) => ({
            title: t.title,
            description: t.description,
            acceptanceRefs: (t.acceptanceRefs as string[]) ?? [],
          })),
          pr: { title: pr.title, body: null, branch: pr.branch },
          files: diff.files,
          skippedFiles: diff.skipped,
          repoAnalysis,
          previousIssues: priorIssues.map((i) => ({
            title: i.title,
            rationale: i.rationale,
            severity: i.severity,
          })),
        });
        await markStep(workflowRunId, "review", "done");
        return r;
      });

      await step.run("save", async () => {
        await markStep(workflowRunId, "save", "running");
        await prisma.review.update({
          where: { id: reviewId },
          data: {
            status: "COMPLETED",
            verdict: result.verdict,
            headSha: pr.headSha,
            summary: buildSummary(result, diff.skipped),
            acceptanceCoverage: result.acceptanceCoverage,
            issues: {
              create: result.issues.map((i) => ({
                severity: i.severity,
                category: i.category,
                title: i.title,
                body: i.body,
                rationale: i.rationale,
                suggestion: i.suggestion || null,
                filePath: i.filePath || null,
                line: i.line,
              })),
            },
          },
        });
        await markStep(workflowRunId, "save", "done");
      });

      await step.run("post", async () => {
        await markStep(workflowRunId, "post", "running");
        try {
          await postReview({
            installationId: pr.repository.installationId!,
            owner: pr.repository.owner,
            repo: pr.repository.name,
            pullNumber: pr.number,
            commitSha: pr.headSha,
            summary: buildSummary(result, diff.skipped),
            verdict: result.verdict,
            issues: result.issues,
          });
          await markStep(workflowRunId, "post", "done");
        } catch (err) {
          // Posting is best-effort: the review is already saved in-app.
          console.error("[pr-ai-review] posting to GitHub failed:", err);
          await markStep(workflowRunId, "post", "failed");
        }
      });

      // Drive the feature status from the review outcome.
      await step.run("advance-status", async () => {
        const blocking = result.issues.filter((i) => i.severity === "BLOCKING").length;
        await prisma.featureRequest.update({
          where: { id: pr.featureRequestId! },
          data: { status: blocking > 0 ? "FIX_NEEDED" : "READY_FOR_APPROVAL" },
        });
      });

      await step.run("complete", () => completeRun(workflowRunId));
      return { verdict: result.verdict, issues: result.issues.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.review
        .update({ where: { id: reviewId }, data: { status: "FAILED", summary: message } })
        .catch(() => undefined);
      await failRun(workflowRunId, message);
      throw err;
    }
  },
);

/** Append an honest note when part of the diff was excluded. */
function buildSummary(
  result: { summary: string },
  skipped: string[],
): string {
  if (!skipped.length) return result.summary;
  return `${result.summary}\n\nNote: ${skipped.length} file(s) were excluded from this review (generated, binary, or oversized): ${skipped.slice(0, 10).join(", ")}${skipped.length > 10 ? "…" : ""}`;
}
