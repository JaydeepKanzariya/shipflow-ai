import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, orgProcedure, router } from "../trpc";

/** Slugify a name into a URL-safe org slug. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const organizationRouter = router({
  /** Organizations the current user is a member of. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const members = await ctx.db.member.findMany({
      where: { userId: ctx.auth.userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      logo: m.organization.logo,
      plan: m.organization.plan,
      role: m.role,
    }));
  }),

  /** The user's active org (from session) resolved to a full record + role. */
  current: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.auth.activeOrganizationId) return null;
    const member = await ctx.db.member.findFirst({
      where: {
        userId: ctx.auth.userId,
        organizationId: ctx.auth.activeOrganizationId,
      },
      include: { organization: true },
    });
    if (!member) return null;
    return {
      id: member.organization.id,
      name: member.organization.name,
      slug: member.organization.slug,
      plan: member.organization.plan,
      role: member.role,
    };
  }),

  /** Resolve an org by slug, verifying the caller is a member. */
  bySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.slug },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });
      const member = await ctx.db.member.findFirst({
        where: { userId: ctx.auth.userId, organizationId: org.id },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        role: member.role,
      };
    }),

  /** Generate an available slug suggestion for a given name. */
  suggestSlug: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const base = slugify(input.name) || "workspace";
      let candidate = base;
      let n = 1;
      // Find the first free slug.
      while (await ctx.db.organization.findUnique({ where: { slug: candidate } })) {
        n += 1;
        candidate = `${base}-${n}`;
      }
      return { slug: candidate };
    }),

  /** Members of the active organization. */
  members: orgProcedure.query(async ({ ctx }) => {
    const members = await ctx.db.member.findMany({
      where: { organizationId: ctx.organizationId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({
      id: m.id,
      role: m.role,
      user: m.user,
      joinedAt: m.createdAt,
    }));
  }),
});
