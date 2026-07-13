import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { PrdSchema } from "@shipflow/ai";
import { inngest } from "@shipflow/jobs";
import { orgProcedure, roleProcedure, router } from "../trpc";

export const prdRouter = router({
  byFeature: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Ensure the feature belongs to the caller's org.
      const feature = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.prd.findUnique({
        where: { featureRequestId: input.featureRequestId },
      });
    }),

  /** Save manual edits to the structured PRD. */
  update: orgProcedure
    .input(
      z.object({
        featureRequestId: z.string(),
        prd: PrdSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.prd.update({
        where: { featureRequestId: input.featureRequestId },
        data: {
          problemStatement: input.prd.problemStatement,
          goals: input.prd.goals,
          nonGoals: input.prd.nonGoals,
          userStories: input.prd.userStories,
          acceptanceCriteria: input.prd.acceptanceCriteria,
          edgeCases: input.prd.edgeCases,
          successMetrics: input.prd.successMetrics,
        },
      });
    }),

  /** Approve the PRD — moves the feature to PRD_APPROVED. Admin/owner only. */
  approve: roleProcedure("admin")
    .input(z.object({ featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true, prd: { select: { id: true } } },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });
      if (!feature.prd) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No PRD to approve yet.",
        });
      }

      await ctx.db.prd.update({
        where: { featureRequestId: input.featureRequestId },
        data: { approvedById: ctx.auth.userId, approvedAt: new Date() },
      });
      await ctx.db.featureRequest.update({
        where: { id: feature.id },
        data: { status: "PRD_APPROVED" },
      });

      // Kick off task generation (Phase 2 — Planning).
      const run = await ctx.db.workflowRun.create({
        data: {
          organizationId: ctx.organizationId,
          featureRequestId: feature.id,
          kind: "TASKS_GENERATE",
          state: "QUEUED",
        },
        select: { id: true },
      });
      await inngest.send({
        name: "tasks.generate.requested",
        data: { featureRequestId: feature.id, workflowRunId: run.id },
      });

      return { ok: true };
    }),
});
