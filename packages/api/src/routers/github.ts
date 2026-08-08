import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getInstallUrl, listInstallationRepos } from "@shipflow/github";
import { inngest } from "@shipflow/jobs";
import { assertWithinLimit, LimitReachedError } from "@shipflow/billing";
import { orgProcedure, roleProcedure, router } from "../trpc";

export const githubRouter = router({
  /** Installation status + connected repo count for the workspace. */
  status: orgProcedure.query(async ({ ctx }) => {
    const org = await ctx.db.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { githubInstallationId: true },
    });
    const repoCount = await ctx.db.repository.count({
      where: { organizationId: ctx.organizationId },
    });
    return {
      connected: !!org.githubInstallationId,
      installationId: org.githubInstallationId,
      repoCount,
      appConfigured: !!process.env.NEXT_PUBLIC_GITHUB_APP_SLUG,
    };
  }),

  /** URL where the user installs the GitHub App (state = org id). */
  installUrl: orgProcedure.query(({ ctx }) => {
    return { url: getInstallUrl(ctx.organizationId) };
  }),

  /** Store the installation id after GitHub's setup redirect. */
  connectInstallation: roleProcedure("admin")
    .input(z.object({ installationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.organization.update({
        where: { id: ctx.organizationId },
        data: { githubInstallationId: input.installationId },
      });
      return { ok: true };
    }),

  /** Repos the installation can see, flagged if already connected. */
  availableRepos: orgProcedure.query(async ({ ctx }) => {
    const org = await ctx.db.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { githubInstallationId: true },
    });
    if (!org.githubInstallationId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "GitHub App is not installed for this workspace yet.",
      });
    }
    const [repos, connected] = await Promise.all([
      listInstallationRepos(org.githubInstallationId),
      ctx.db.repository.findMany({
        where: { organizationId: ctx.organizationId },
        select: { fullName: true },
      }),
    ]);
    const connectedSet = new Set(connected.map((r) => r.fullName));
    return repos.map((r) => ({ ...r, connected: connectedSet.has(r.fullName) }));
  }),

  /** Connect a repo to a project and kick off the AI repo analysis. */
  connectRepo: roleProcedure("admin")
    .input(
      z.object({
        projectId: z.string(),
        owner: z.string(),
        name: z.string(),
        fullName: z.string(),
        githubRepoId: z.string(),
        defaultBranch: z.string().default("main"),
        private: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { githubInstallationId: true },
      });
      if (!org.githubInstallationId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED" });
      }
      const project = await ctx.db.project.findFirst({
        where: { id: input.projectId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!project) throw new TRPCError({ code: "FORBIDDEN" });

      // Plan gate: repository limit — only for a genuinely new repo.
      const already = await ctx.db.repository.findUnique({
        where: {
          organizationId_fullName: {
            organizationId: ctx.organizationId,
            fullName: input.fullName,
          },
        },
        select: { id: true },
      });
      if (!already) {
        try {
          await assertWithinLimit(ctx.organizationId, "repositories");
        } catch (err) {
          if (err instanceof LimitReachedError) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You've reached your plan's repository limit. Upgrade to connect more.",
              cause: err,
            });
          }
          throw err;
        }
      }

      const repo = await ctx.db.repository.upsert({
        where: {
          organizationId_fullName: {
            organizationId: ctx.organizationId,
            fullName: input.fullName,
          },
        },
        create: {
          organizationId: ctx.organizationId,
          projectId: input.projectId,
          owner: input.owner,
          name: input.name,
          fullName: input.fullName,
          githubRepoId: input.githubRepoId,
          defaultBranch: input.defaultBranch,
          private: input.private,
          installationId: org.githubInstallationId,
        },
        update: {
          installationId: org.githubInstallationId,
          defaultBranch: input.defaultBranch,
        },
        select: { id: true },
      });

      const run = await ctx.db.workflowRun.create({
        data: {
          organizationId: ctx.organizationId,
          kind: "REPO_ANALYZE",
          state: "QUEUED",
        },
        select: { id: true },
      });
      await inngest.send({
        name: "repo.analyze.requested",
        data: { repositoryId: repo.id, workflowRunId: run.id },
      });

      return { id: repo.id };
    }),

  /** Connected repos with their latest analysis. */
  connectedRepos: orgProcedure.query(async ({ ctx }) => {
    const repos = await ctx.db.repository.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "asc" },
      include: {
        project: { select: { id: true, name: true } },
        analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    return repos.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      defaultBranch: r.defaultBranch,
      private: r.private,
      project: r.project,
      latestAnalysis: r.analyses[0] ?? null,
    }));
  }),

  disconnectRepo: roleProcedure("admin")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.repository.deleteMany({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      return { ok: true };
    }),
});
