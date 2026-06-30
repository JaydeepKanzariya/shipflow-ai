import { z } from "zod";
import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  ping: publicProcedure.query(() => {
    return { ok: true, service: "shipflow-api", time: new Date().toISOString() };
  }),

  /** Verifies the database connection round-trips. */
  db: publicProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    return { ok: result[0]?.ok === 1 };
  }),

  echo: publicProcedure
    .input(z.object({ message: z.string() }))
    .query(({ input }) => ({ message: input.message })),
});
