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

/** Role hierarchy for elevation checks (higher index = more privilege). */
const ROLE_ORDER = ["member", "reviewer", "admin", "owner"] as const;
export type OrgRole = (typeof ROLE_ORDER)[number];

function roleRank(role: string): number {
  const i = ROLE_ORDER.indexOf(role.toLowerCase() as OrgRole);
  return i === -1 ? 0 : i;
}

/**
 * Requires an authenticated user with an active organization they belong to.
 * Verifies membership against the DB and surfaces organizationId + role on ctx
 * so downstream procedures can scope every query by tenant.
 */
export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  let organizationId = ctx.auth.activeOrganizationId;
  let role: string | undefined;

  if (organizationId) {
    const member = await ctx.db.member.findFirst({
      where: { userId: ctx.auth.userId, organizationId },
      select: { role: true },
    });
    if (member) role = member.role;
    else organizationId = null; // active org set but not a member — fall through
  }

  // Fallback: no (valid) active org on the session yet. Resolve the user's
  // membership directly. Common on first navigation before the org layout has
  // set the active org, and for single-org users. Prefer the oldest membership
  // for determinism.
  if (!organizationId || role === undefined) {
    const member = await ctx.db.member.findFirst({
      where: { userId: ctx.auth.userId },
      orderBy: { createdAt: "asc" },
      select: { role: true, organizationId: true },
    });
    if (!member) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't belong to any organization yet.",
      });
    }
    organizationId = member.organizationId;
    role = member.role;
  }

  return next({
    ctx: {
      ...ctx,
      organizationId,
      role,
    },
  });
});

/**
 * Like orgProcedure, but requires at least `minRole` in the active org.
 * Usage: roleProcedure("admin").mutation(...)
 */
export function roleProcedure(minRole: OrgRole) {
  return orgProcedure.use(({ ctx, next }) => {
    if (roleRank(ctx.role) < roleRank(minRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires ${minRole} role or higher.`,
      });
    }
    return next({ ctx });
  });
}
