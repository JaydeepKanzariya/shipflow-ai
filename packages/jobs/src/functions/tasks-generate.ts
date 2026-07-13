import { prisma } from "@shipflow/db";
import { generateTasks, PrdSchema } from "@shipflow/ai";
import { inngest } from "../client";
import { startRun, markStep, completeRun, failRun } from "../progress";

/**
 * Break an approved PRD into engineering tasks. Triggered when a PRD is
 * approved (tasks.generate.requested). Creates Task rows in BACKLOG and moves
 * the feature to TASKS_READY once the plan exists.
 */
export const tasksGenerate = inngest.createFunction(
  { id: "tasks-generate", name: "Tasks: generate from PRD" },
  { event: "tasks.generate.requested" },
  async ({ event, step }) => {
    const { featureRequestId, workflowRunId } = event.data;

    await step.run("start", () =>
      startRun(workflowRunId, [
        { step: "load", label: "Loading PRD", status: "pending" },
        { step: "generate", label: "Generating engineering tasks", status: "pending" },
        { step: "save", label: "Creating tasks", status: "pending" },
      ]),
    );

    try {
      const feature = await step.run("load", async () => {
        await markStep(workflowRunId, "load", "running");
        const f = await prisma.featureRequest.findUniqueOrThrow({
          where: { id: featureRequestId },
          select: { title: true, prd: true },
        });
        if (!f.prd) throw new Error("No PRD to generate tasks from.");
        await markStep(workflowRunId, "load", "done");
        return f;
      });

      // Rebuild a validated PRD object from the stored JSON columns.
      const prd = PrdSchema.parse({
        problemStatement: feature.prd!.problemStatement,
        goals: feature.prd!.goals,
        nonGoals: feature.prd!.nonGoals,
        userStories: feature.prd!.userStories,
        acceptanceCriteria: feature.prd!.acceptanceCriteria,
        edgeCases: feature.prd!.edgeCases,
        successMetrics: feature.prd!.successMetrics,
      });

      const result = await step.run("generate", async () => {
        await markStep(workflowRunId, "generate", "running");
        const r = await generateTasks({ title: feature.title, prd });
        await markStep(workflowRunId, "generate", "done");
        return r;
      });

      await step.run("save", async () => {
        await markStep(workflowRunId, "save", "running");
        // Replace any prior generated tasks for a clean re-run.
        await prisma.task.deleteMany({ where: { featureRequestId } });
        await prisma.task.createMany({
          data: result.tasks.map((t, i) => ({
            featureRequestId,
            title: t.title,
            description: t.description,
            acceptanceRefs: t.acceptanceRefs,
            status: "BACKLOG" as const,
            order: i,
          })),
        });
        // Tasks now exist for team review; feature stays PRD_APPROVED until a
        // human approves the plan (-> TASKS_READY via task.approvePlan).
        await markStep(workflowRunId, "save", "done");
      });

      await step.run("complete", () => completeRun(workflowRunId));
      return { count: result.tasks.length };
    } catch (err) {
      await failRun(workflowRunId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  },
);
