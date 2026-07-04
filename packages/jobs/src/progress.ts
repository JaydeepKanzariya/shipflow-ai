import { prisma } from "@shipflow/db";

export type ProgressStep = {
  step: string;
  label: string;
  status: "pending" | "running" | "done" | "failed";
};

/** Mark a workflow run as running and set its initial step list. */
export async function startRun(workflowRunId: string, steps: ProgressStep[]) {
  await prisma.workflowRun.update({
    where: { id: workflowRunId },
    data: { state: "RUNNING", progress: steps },
  });
}

/** Update one step's status within a run's progress array. */
export async function markStep(
  workflowRunId: string,
  step: string,
  status: ProgressStep["status"],
) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: workflowRunId },
    select: { progress: true },
  });
  const steps = (run?.progress as ProgressStep[] | null) ?? [];
  const next = steps.map((s) => (s.step === step ? { ...s, status } : s));
  await prisma.workflowRun.update({
    where: { id: workflowRunId },
    data: { progress: next },
  });
}

/** Mark the whole run completed. */
export async function completeRun(workflowRunId: string) {
  await prisma.workflowRun.update({
    where: { id: workflowRunId },
    data: { state: "COMPLETED", completedAt: new Date() },
  });
}

/** Mark the run failed with an error message. */
export async function failRun(workflowRunId: string, error: string) {
  await prisma.workflowRun.update({
    where: { id: workflowRunId },
    data: { state: "FAILED", error, completedAt: new Date() },
  });
}
