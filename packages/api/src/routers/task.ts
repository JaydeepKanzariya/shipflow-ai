import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@shipflow/db";
import { inngest } from "@shipflow/jobs";
import { orgProcedure, roleProcedure, router } from "../trpc";

const TASK_STATUS = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;

/** Verify a feature belongs to the caller's org; returns it or throws. */
async function assertFeature(featureRequestId: string, organizationId: string) {
  const feature = await prisma.featureRequest.findFirst({
    where: { id: featureRequestId, organizationId },
    select: { id: true, status: true },
  });
  if (!feature) throw new TRPCError({ code: "NOT_FOUND" });
  return feature;
}

export const taskRouter = router({
  /** All tasks for a feature, ordered for the board. */
  byFeature: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertFeature(input.featureRequestId, ctx.organizationId);
      return ctx.db.task.findMany({
        where: { featureRequestId: input.featureRequestId },
        orderBy: [{ status: "asc" }, { order: "asc" }],
        include: {
          assignee: { select: { id: true, name: true, image: true } },
        },
      });
    }),

  /** Move a task to a new column and position (drag-and-drop). */
  move: orgProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(TASK_STATUS),
        order: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findFirst({
        where: {
          id: input.id,
          featureRequest: { organizationId: ctx.organizationId },
        },
        select: { id: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.task.update({
        where: { id: input.id },
        data: { status: input.status, order: input.order },
      });
    }),

  create: orgProcedure
    .input(
      z.object({
        featureRequestId: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertFeature(input.featureRequestId, ctx.organizationId);
      const count = await ctx.db.task.count({
        where: { featureRequestId: input.featureRequestId, status: "BACKLOG" },
      });
      return ctx.db.task.create({
        data: {
          featureRequestId: input.featureRequestId,
          title: input.title,
          description: input.description,
          acceptanceRefs: [],
          status: "BACKLOG",
          order: count,
        },
      });
    }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findFirst({
        where: {
          id: input.id,
          featureRequest: { organizationId: ctx.organizationId },
        },
        select: { id: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.task.update({
        where: { id: input.id },
        data: { title: input.title, description: input.description },
      });
    }),

  delete: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Idempotent: deleting a task that's already gone is a no-op, not an
      // error (avoids double-click races). deleteMany scopes by org for
      // tenant safety and returns count 0 when nothing matches.
      await ctx.db.task.deleteMany({
        where: {
          id: input.id,
          featureRequest: { organizationId: ctx.organizationId },
        },
      });
      return { ok: true };
    }),

  /** Regenerate the task plan from the PRD (re-runs the AI workflow). */
  regenerate: roleProcedure("admin")
    .input(z.object({ featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const feature = await assertFeature(
        input.featureRequestId,
        ctx.organizationId,
      );
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

  /** Approve the plan — advances the feature to TASKS_READY. Admin/owner. */
  approvePlan: roleProcedure("admin")
    .input(z.object({ featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const feature = await assertFeature(
        input.featureRequestId,
        ctx.organizationId,
      );
      const taskCount = await ctx.db.task.count({
        where: { featureRequestId: feature.id },
      });
      if (taskCount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No tasks to approve yet.",
        });
      }
      await ctx.db.featureRequest.update({
        where: { id: feature.id },
        data: { status: "TASKS_READY" },
      });
      return { ok: true };
    }),
});
