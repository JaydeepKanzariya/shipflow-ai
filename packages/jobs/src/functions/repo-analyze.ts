import { prisma } from "@shipflow/db";
import { analyzeRepo } from "@shipflow/ai";
import { getRepoOverview } from "@shipflow/github";
import { inngest } from "../client";
import { startRun, markStep, completeRun, failRun } from "../progress";

/**
 * Analyze a connected repository: fetch its tree + key files via Octokit,
 * summarize stack/structure/conventions with AI, store a RepoAnalysis row.
 * Runs when a repo is connected (and on demand).
 */
export const repoAnalyze = inngest.createFunction(
  { id: "repo-analyze", name: "Repo: analyze" },
  { event: "repo.analyze.requested" },
  async ({ event, step }) => {
    const { repositoryId, workflowRunId } = event.data;

    await step.run("start", () =>
      startRun(workflowRunId, [
        { step: "fetch", label: "Fetching repository snapshot", status: "pending" },
        { step: "analyze", label: "Analyzing with AI", status: "pending" },
        { step: "save", label: "Saving analysis", status: "pending" },
      ]),
    );

    try {
      const repo = await step.run("load-repo", () =>
        prisma.repository.findUniqueOrThrow({
          where: { id: repositoryId },
          select: { owner: true, name: true, installationId: true },
        }),
      );
      if (!repo.installationId) throw new Error("Repository has no installation.");

      const overview = await step.run("fetch", async () => {
        await markStep(workflowRunId, "fetch", "running");
        const o = await getRepoOverview({
          installationId: repo.installationId!,
          owner: repo.owner,
          repo: repo.name,
        });
        await markStep(workflowRunId, "fetch", "done");
        return o;
      });

      const analysis = await step.run("analyze", async () => {
        await markStep(workflowRunId, "analyze", "running");
        const a = await analyzeRepo({
          fullName: overview.fullName,
          description: overview.description,
          languages: overview.languages,
          tree: overview.tree,
          keyFiles: overview.keyFiles,
        });
        await markStep(workflowRunId, "analyze", "done");
        return a;
      });

      await step.run("save", async () => {
        await markStep(workflowRunId, "save", "running");
        await prisma.repoAnalysis.create({
          data: {
            repositoryId,
            summary: analysis.summary,
            details: {
              stack: analysis.stack,
              structure: analysis.structure,
              conventions: analysis.conventions,
              entryPoints: analysis.entryPoints,
              risks: analysis.risks,
            },
          },
        });
        await markStep(workflowRunId, "save", "done");
      });

      await step.run("complete", () => completeRun(workflowRunId));
      return { ok: true };
    } catch (err) {
      await failRun(workflowRunId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  },
);
