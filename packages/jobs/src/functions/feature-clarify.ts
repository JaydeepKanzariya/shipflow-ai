import { prisma } from "@shipflow/db";
import { assessRequest } from "@shipflow/ai";
import { inngest } from "../client";
import { startRun, markStep, completeRun, failRun } from "../progress";

/**
 * Discovery triage. On feature.submitted:
 *  - assess the request (clarify / educate / proceed)
 *  - clarify  → store questions, status CLARIFYING
 *  - educate  → store message, status REJECTED (user can still proceed)
 *  - proceed  → kick off PRD generation
 */
export const featureClarify = inngest.createFunction(
  { id: "feature-clarify", name: "Feature: clarify" },
  { event: "feature.submitted" },
  async ({ event, step }) => {
    const { featureRequestId, workflowRunId } = event.data;

    await step.run("start", () =>
      startRun(workflowRunId, [
        { step: "load", label: "Loading request", status: "pending" },
        { step: "assess", label: "Assessing request with AI", status: "pending" },
        { step: "save", label: "Saving discovery result", status: "pending" },
      ]),
    );

    try {
      const feature = await step.run("load", async () => {
        await markStep(workflowRunId, "load", "running");
        const f = await prisma.featureRequest.findUniqueOrThrow({
          where: { id: featureRequestId },
          select: { title: true, rawText: true },
        });
        await markStep(workflowRunId, "load", "done");
        return f;
      });

      const assessment = await step.run("assess", async () => {
        await markStep(workflowRunId, "assess", "running");
        const result = await assessRequest({
          title: feature.title,
          rawText: feature.rawText,
        });
        await markStep(workflowRunId, "assess", "done");
        return result;
      });

      await step.run("save", async () => {
        await markStep(workflowRunId, "save", "running");
        if (assessment.decision === "clarify") {
          await prisma.featureRequest.update({
            where: { id: featureRequestId },
            data: {
              status: "CLARIFYING",
              clarifyingQA: { questions: assessment.questions, answers: [] },
              decisionNote: assessment.reasoning,
            },
          });
        } else if (assessment.decision === "educate") {
          await prisma.featureRequest.update({
            where: { id: featureRequestId },
            data: {
              status: "REJECTED",
              decisionNote: assessment.educateMessage || assessment.reasoning,
            },
          });
        } else {
          await prisma.featureRequest.update({
            where: { id: featureRequestId },
            data: { status: "PRD_DRAFT", decisionNote: assessment.reasoning },
          });
        }
        await markStep(workflowRunId, "save", "done");
      });

      await step.run("complete", () => completeRun(workflowRunId));

      // If clear enough, proceed straight to PRD generation.
      if (assessment.decision === "proceed") {
        await step.sendEvent("kickoff-prd", {
          name: "prd.generate.requested",
          data: { featureRequestId, workflowRunId },
        });
      }

      return { decision: assessment.decision };
    } catch (err) {
      await failRun(workflowRunId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  },
);
