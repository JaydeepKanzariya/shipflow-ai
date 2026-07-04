import { z } from "zod";
import { orgProcedure, router } from "../trpc";

export const projectRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.project.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, description: true, createdAt: true },
    });
  }),

  create: orgProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.project.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          description: input.description,
        },
        select: { id: true, name: true },
      });
    }),

  /** Return an existing default project for the org, creating one if needed. */
  ensureDefault: orgProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.project.findFirst({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    if (existing) return existing;
    return ctx.db.project.create({
      data: { organizationId: ctx.organizationId, name: "General" },
      select: { id: true, name: true },
    });
  }),
});
