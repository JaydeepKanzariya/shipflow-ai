import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { orgProcedure, router } from "../trpc";

export const pullRequestRouter = router({
  /** PRs linked to a feature, newest first. */
  byFeature: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.pullRequest.findMany({
        where: {
          featureRequestId: input.featureRequestId,
          organizationId: ctx.organizationId,
        },
        orderBy: { createdAt: "desc" },
        include: { repository: { select: { fullName: true } } },
      });
    }),

  /** Tracked PRs not yet linked to any feature (for manual linking). */
  unlinked: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.pullRequest.findMany({
      where: { organizationId: ctx.organizationId, featureRequestId: null },
      orderBy: { createdAt: "desc" },
      include: { repository: { select: { fullName: true } } },
    });
  }),

  /** Manually link a PR to a feature; moves planned features into dev. */
  link: orgProcedure
    .input(z.object({ id: z.string(), featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [pr, feature] = await Promise.all([
        ctx.db.pullRequest.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
          select: { id: true },
        }),
        ctx.db.featureRequest.findFirst({
          where: {
            id: input.featureRequestId,
            organizationId: ctx.organizationId,
          },
          select: { id: true, status: true },
        }),
      ]);
      if (!pr || !feature) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.pullRequest.update({
        where: { id: pr.id },
        data: { featureRequestId: feature.id },
      });
      if (feature.status === "TASKS_READY" || feature.status === "PRD_APPROVED") {
        await ctx.db.featureRequest.update({
          where: { id: feature.id },
          data: { status: "IN_DEVELOPMENT" },
        });
      }
      return { ok: true };
    }),

  unlink: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.pullRequest.updateMany({
        where: { id: input.id, organizationId: ctx.organizationId },
        data: { featureRequestId: null },
      });
      return { ok: true };
    }),
});
