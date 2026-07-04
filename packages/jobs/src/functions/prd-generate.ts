import { prisma } from "@shipflow/db";
import { generatePrd, type ClarifyingAnswers } from "@shipflow/ai";
import { inngest } from "../client";
import { startRun, markStep, completeRun, failRun } from "../progress";

/**
 * PRD generation. Triggered either when the user submits clarifying answers
 * (feature.clarified) or when triage decided to proceed directly
 * (prd.generate.requested). Produces a structured PRD and stores it.
 */
export const prdGenerate = inngest.createFunction(
  { id: "prd-generate", name: "PRD: generate" },
  [{ event: "feature.clarified" }, { event: "prd.generate.requested" }],
  async ({ event, step }) => {
    const { featureRequestId, workflowRunId } = event.data;

    await step.run("start", () =>
      startRun(workflowRunId, [
        { step: "load", label: "Loading request + answers", status: "pending" },
        { step: "generate", label: "Generating PRD with AI", status: "pending" },
        { step: "save", label: "Saving PRD", status: "pending" },
      ]),
    );

    try {
      const feature = await step.run("load", async () => {
        await markStep(workflowRunId, "load", "running");
        const f = await prisma.featureRequest.findUniqueOrThrow({
          where: { id: featureRequestId },
          select: { title: true, rawText: true, clarifyingQA: true },
        });
        await markStep(workflowRunId, "load", "done");
        return f;
      });

      const answers = extractAnswers(feature.clarifyingQA);

      const prd = await step.run("generate", async () => {
        await markStep(workflowRunId, "generate", "running");
        const result = await generatePrd({
          title: feature.title,
          rawText: feature.rawText,
          answers,
        });
        await markStep(workflowRunId, "generate", "done");
        return result;
      });

      await step.run("save", async () => {
        await markStep(workflowRunId, "save", "running");
        await prisma.prd.upsert({
          where: { featureRequestId },
          create: {
            featureRequestId,
            problemStatement: prd.problemStatement,
            goals: prd.goals,
            nonGoals: prd.nonGoals,
            userStories: prd.userStories,
            acceptanceCriteria: prd.acceptanceCriteria,
            edgeCases: prd.edgeCases,
            successMetrics: prd.successMetrics,
          },
          update: {
            problemStatement: prd.problemStatement,
            goals: prd.goals,
            nonGoals: prd.nonGoals,
            userStories: prd.userStories,
            acceptanceCriteria: prd.acceptanceCriteria,
            edgeCases: prd.edgeCases,
            successMetrics: prd.successMetrics,
            version: { increment: 1 },
          },
        });
        await prisma.featureRequest.update({
          where: { id: featureRequestId },
          data: { status: "PRD_DRAFT" },
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

/** Pull the collected clarifying answers out of the stored JSON blob. */
function extractAnswers(clarifyingQA: unknown): ClarifyingAnswers {
  if (
    clarifyingQA &&
    typeof clarifyingQA === "object" &&
    "answers" in clarifyingQA &&
    Array.isArray((clarifyingQA as { answers: unknown }).answers)
  ) {
    return (clarifyingQA as { answers: ClarifyingAnswers }).answers;
  }
  return [];
}
