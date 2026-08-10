import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@shipflow/db";
import { inngest } from "@shipflow/jobs";
import { assertWithinLimit, incrementUsage, LimitReachedError } from "@shipflow/billing";
import { orgProcedure, router } from "../trpc";

/** Turn a billing LimitReachedError into a tRPC FORBIDDEN with an upgrade hint. */
function toLimitError(err: unknown): never {
  if (err instanceof LimitReachedError) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've reached your plan's limit for ${err.metric.replace(/_/g, " ")}. Upgrade to continue.`,
      cause: err,
    });
  }
  throw err;
}

const SOURCES = ["EMAIL", "TICKET", "CALL", "MANUAL", "API"] as const;

export const featureRequestRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.featureRequest.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        source: true,
        status: true,
        createdAt: true,
        shippedAt: true,
        project: { select: { id: true, name: true } },
        prd: { select: { id: true } },
      },
    });
  }),

  byId: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        include: {
          project: { select: { id: true, name: true } },
          prd: true,
          workflowRuns: { orderBy: { startedAt: "desc" }, take: 5 },
          tasks: { select: { id: true } },
        },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });
      return feature;
    }),

  create: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1).max(200),
        rawText: z.string().min(1),
        source: z.enum(SOURCES).default("MANUAL"),
        requesterEmail: z.string().email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the project belongs to this org (tenant safety).
      const project = await ctx.db.project.findFirst({
        where: { id: input.projectId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!project) throw new TRPCError({ code: "FORBIDDEN" });

      // Plan gate: monthly feature-request quota.
      await assertWithinLimit(ctx.organizationId, "feature_requests").catch(
        toLimitError,
      );

      const feature = await ctx.db.featureRequest.create({
        data: {
          organizationId: ctx.organizationId,
          projectId: input.projectId,
          title: input.title,
          rawText: input.rawText,
          source: input.source,
          requesterEmail: input.requesterEmail,
          requestedById: ctx.auth.userId,
          status: "DISCOVERY",
        },
        select: { id: true },
      });

      const run = await ctx.db.workflowRun.create({
        data: {
          organizationId: ctx.organizationId,
          featureRequestId: feature.id,
          kind: "FEATURE_CLARIFY",
          state: "QUEUED",
        },
        select: { id: true },
      });

      await inngest.send({
        name: "feature.submitted",
        data: { featureRequestId: feature.id, workflowRunId: run.id },
      });

      await incrementUsage(ctx.organizationId, "feature_requests");
      return { id: feature.id };
    }),

  /** Submit answers to the AI's clarifying questions, then generate the PRD. */
  submitAnswers: orgProcedure
    .input(
      z.object({
        id: z.string(),
        answers: z.array(
          z.object({ question: z.string(), answer: z.string() }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: { id: true, clarifyingQA: true },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });

      const existing =
        (feature.clarifyingQA as Record<string, unknown> | null) ?? {};

      await ctx.db.featureRequest.update({
        where: { id: feature.id },
        data: {
          clarifyingQA: {
            ...existing,
            answers: input.answers,
          } as Prisma.InputJsonValue,
          status: "DISCOVERY",
        },
      });

      const run = await ctx.db.workflowRun.create({
        data: {
          organizationId: ctx.organizationId,
          featureRequestId: feature.id,
          kind: "PRD_GENERATE",
          state: "QUEUED",
        },
        select: { id: true },
      });

      await inngest.send({
        name: "feature.clarified",
        data: { featureRequestId: feature.id, workflowRunId: run.id },
      });

      return { ok: true };
    }),

  /** User overrides an 'educate' decision and proceeds to build anyway. */
  proceedAnyway: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });

      const run = await ctx.db.workflowRun.create({
        data: {
          organizationId: ctx.organizationId,
          featureRequestId: feature.id,
          kind: "PRD_GENERATE",
          state: "QUEUED",
        },
        select: { id: true },
      });

      await ctx.db.featureRequest.update({
        where: { id: feature.id },
        data: { status: "DISCOVERY" },
      });

      await inngest.send({
        name: "prd.generate.requested",
        data: { featureRequestId: feature.id, workflowRunId: run.id },
      });

      return { ok: true };
    }),

  reject: orgProcedure
    .input(z.object({ id: z.string(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.featureRequest.update({
        where: { id: feature.id },
        data: { status: "REJECTED", decisionNote: input.note },
      });
      return { ok: true };
    }),
});
