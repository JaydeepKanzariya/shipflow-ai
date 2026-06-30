import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const router = t.router;
export const middleware = t.middleware;

/** Open to anyone (e.g. health, public marketing data). */
export const publicProcedure = t.procedure;

/** Requires an authenticated user. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, auth: ctx.auth },
  });
});

/**
 * Requires an authenticated user with an active organization. The org id is
 * surfaced on ctx so downstream procedures can scope every query by tenant.
 * Membership verification is added with the auth layer in M2.
 */
export const orgProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.auth.activeOrganizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active organization selected.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      organizationId: ctx.auth.activeOrganizationId,
    },
  });
});
