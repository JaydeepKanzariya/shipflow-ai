import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { inngest } from "@shipflow/jobs";
import { assertWithinLimit, incrementUsage, LimitReachedError } from "@shipflow/billing";
import { orgProcedure, router } from "../trpc";

export const reviewRouter = router({
  /** Reviews for a PR, newest first, with their issues. */
  byPullRequest: orgProcedure
    .input(z.object({ pullRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const pr = await ctx.db.pullRequest.findFirst({
        where: { id: input.pullRequestId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!pr) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.review.findMany({
        where: { pullRequestId: pr.id },
        orderBy: { createdAt: "desc" },
        include: { issues: { orderBy: [{ severity: "asc" }, { createdAt: "asc" }] } },
      });
    }),

  /** Recent AI reviews across the whole org — for the Reviews page. */
  recent: orgProcedure.query(async ({ ctx }) => {
    const reviews = await ctx.db.review.findMany({
      where: { pullRequest: { organizationId: ctx.organizationId } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        issues: { select: { severity: true } },
        pullRequest: {
          select: {
            number: true,
            title: true,
            url: true,
            repository: { select: { fullName: true } },
            featureRequest: { select: { id: true, title: true } },
          },
        },
      },
    });
    return reviews.map((r) => ({
      id: r.id,
      verdict: r.verdict,
      status: r.status,
      summary: r.summary,
      createdAt: r.createdAt,
      blocking: r.issues.filter((i) => i.severity === "BLOCKING").length,
      nonBlocking: r.issues.filter((i) => i.severity === "NON_BLOCKING").length,
      pr: r.pullRequest,
    }));
  }),

  /** Full review history across every PR on a feature. */
  history: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.review.findMany({
        where: {
          pullRequest: {
            featureRequestId: input.featureRequestId,
            organizationId: ctx.organizationId,
          },
        },
        orderBy: { createdAt: "desc" },
        include: {
          issues: true,
          pullRequest: { select: { number: true, repository: { select: { fullName: true } } } },
        },
      });
    }),

  /** Manually trigger an AI review for a PR ("Review now"). */
  run: orgProcedure
    .input(z.object({ pullRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const pr = await ctx.db.pullRequest.findFirst({
        where: { id: input.pullRequestId, organizationId: ctx.organizationId },
        select: {
          id: true,
          featureRequestId: true,
          featureRequest: { select: { prd: { select: { id: true } } } },
        },
      });
      if (!pr) throw new TRPCError({ code: "NOT_FOUND" });
      if (!pr.featureRequestId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Link this pull request to a feature before reviewing.",
        });
      }
      if (!pr.featureRequest?.prd) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The linked feature has no PRD to review against yet.",
        });
      }

      // Plan gate: AI review credits.
      try {
        await assertWithinLimit(ctx.organizationId, "ai_review_credits");
      } catch (err) {
        if (err instanceof LimitReachedError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You're out of AI review credits for this month. Upgrade for more.",
            cause: err,
          });
        }
        throw err;
      }

      const run = await ctx.db.workflowRun.create({
        data: {
          organizationId: ctx.organizationId,
          featureRequestId: pr.featureRequestId,
          kind: "PR_AI_REVIEW",
          state: "QUEUED",
        },
        select: { id: true },
      });
      await ctx.db.featureRequest.update({
        where: { id: pr.featureRequestId },
        data: { status: "IN_AI_REVIEW" },
      });
      await inngest.send({
        name: "pr.review.requested",
        data: { pullRequestId: pr.id, workflowRunId: run.id },
      });
      await incrementUsage(ctx.organizationId, "ai_review_credits");
      return { ok: true };
    }),

  /** Mark an issue resolved (or not) as fixes land. */
  setIssueResolved: orgProcedure
    .input(z.object({ id: z.string(), resolved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const issue = await ctx.db.reviewIssue.findFirst({
        where: {
          id: input.id,
          review: { pullRequest: { organizationId: ctx.organizationId } },
        },
        select: { id: true },
      });
      if (!issue) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.reviewIssue.update({
        where: { id: issue.id },
        data: { resolved: input.resolved },
      });
      return { ok: true };
    }),
});
