import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { inngest } from "@shipflow/jobs";
import { orgProcedure, roleProcedure, router } from "../trpc";

/** Everything the human approver needs to see, in one query. */
async function loadReleaseContext(
  db: import("@shipflow/db").PrismaClient,
  featureRequestId: string,
  organizationId: string,
) {
  const feature = await db.featureRequest.findFirst({
    where: { id: featureRequestId, organizationId },
    include: {
      prd: true,
      tasks: true,
      releaseApprovedBy: { select: { id: true, name: true, email: true } },
      pullRequests: {
        include: {
          repository: { select: { fullName: true } },
          reviews: { orderBy: { createdAt: "desc" }, include: { issues: true } },
        },
      },
    },
  });
  if (!feature) throw new TRPCError({ code: "NOT_FOUND" });
  return feature;
}

export const releaseRouter = router({
  /** Approval dashboard: PRD, tasks, PRs, review history, open issues. */
  overview: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const feature = await loadReleaseContext(
        ctx.db,
        input.featureRequestId,
        ctx.organizationId,
      );
      const reviews = feature.pullRequests.flatMap((p) => p.reviews);
      const openIssues = reviews.flatMap((r) => r.issues).filter((i) => !i.resolved);
      const blockingOpen = openIssues.filter((i) => i.severity === "BLOCKING");

      return {
        id: feature.id,
        title: feature.title,
        status: feature.status,
        prd: feature.prd,
        tasks: feature.tasks,
        pullRequests: feature.pullRequests.map((p) => ({
          id: p.id,
          number: p.number,
          title: p.title,
          state: p.state,
          url: p.url,
          repository: p.repository,
          latestReview: p.reviews[0]
            ? {
                verdict: p.reviews[0].verdict,
                summary: p.reviews[0].summary,
                createdAt: p.reviews[0].createdAt,
                acceptanceCoverage: p.reviews[0].acceptanceCoverage,
              }
            : null,
        })),
        reviewCount: reviews.length,
        openIssues,
        blockingCount: blockingOpen.length,
        readiness: feature.releaseReadiness,
        approvedBy: feature.releaseApprovedBy,
        approvedAt: feature.releaseApprovedAt,
        decisionNote: feature.releaseDecisionNote,
        shippedAt: feature.shippedAt,
        // Approval requires no unresolved blocking issues.
        canApprove: blockingOpen.length === 0,
      };
    }),

  /** Run (or refresh) the AI release-readiness assessment. */
  runReadiness: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true, prd: { select: { id: true } } },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });
      if (!feature.prd) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This feature has no PRD to assess.",
        });
      }

      const run = await ctx.db.workflowRun.create({
        data: {
          organizationId: ctx.organizationId,
          featureRequestId: feature.id,
          kind: "RELEASE_READINESS",
          state: "QUEUED",
        },
        select: { id: true },
      });
      await inngest.send({
        name: "release.readiness.requested",
        data: { featureRequestId: feature.id, workflowRunId: run.id },
      });
      return { ok: true };
    }),

  /**
   * Human approves the release. Blocked while unresolved BLOCKING issues
   * remain unless an admin explicitly overrides with a reason.
   */
  approve: roleProcedure("admin")
    .input(
      z.object({
        featureRequestId: z.string(),
        note: z.string().max(2000).optional(),
        /** Approve despite unresolved blocking issues (reason required). */
        overrideBlocking: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const feature = await loadReleaseContext(
        ctx.db,
        input.featureRequestId,
        ctx.organizationId,
      );
      const blockingOpen = feature.pullRequests
        .flatMap((p) => p.reviews)
        .flatMap((r) => r.issues)
        .filter((i) => !i.resolved && i.severity === "BLOCKING");

      if (blockingOpen.length > 0) {
        if (!input.overrideBlocking) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `${blockingOpen.length} blocking issue(s) are unresolved. Resolve them or override with a reason.`,
          });
        }
        if (!input.note?.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A reason is required to override blocking issues.",
          });
        }
      }

      await ctx.db.featureRequest.update({
        where: { id: feature.id },
        data: {
          status: "APPROVED",
          releaseApprovedById: ctx.auth.userId,
          releaseApprovedAt: new Date(),
          releaseDecisionNote: input.note?.trim() || null,
        },
      });
      await ctx.db.auditEvent.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.auth.userId,
          action: "release.approved",
          entityType: "FeatureRequest",
          entityId: feature.id,
          metadata: {
            overrodeBlocking: blockingOpen.length > 0,
            blockingCount: blockingOpen.length,
          },
        },
      });
      return { ok: true };
    }),

  /** Human rejects the release — back to fix-needed with a reason. */
  reject: roleProcedure("admin")
    .input(
      z.object({
        featureRequestId: z.string(),
        note: z.string().min(1, "A reason is required.").max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.featureRequest.update({
        where: { id: feature.id },
        data: { status: "FIX_NEEDED", releaseDecisionNote: input.note },
      });
      await ctx.db.auditEvent.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.auth.userId,
          action: "release.rejected",
          entityType: "FeatureRequest",
          entityId: feature.id,
          metadata: { note: input.note },
        },
      });
      return { ok: true };
    }),

  /** Mark an approved feature as shipped. Only APPROVED can ship. */
  ship: roleProcedure("admin")
    .input(z.object({ featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true, status: true },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });
      if (feature.status !== "APPROVED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only an approved feature can be shipped.",
        });
      }

      await ctx.db.featureRequest.update({
        where: { id: feature.id },
        data: { status: "SHIPPED", shippedAt: new Date() },
      });
      await ctx.db.auditEvent.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.auth.userId,
          action: "release.shipped",
          entityType: "FeatureRequest",
          entityId: feature.id,
        },
      });
      return { ok: true };
    }),
});
