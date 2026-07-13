import { runStructured } from "./model";
import { TaskListSchema, type TaskList, type Prd } from "./schemas";

export interface GenerateTasksInput {
  title: string;
  prd: Prd;
}

/**
 * Break an approved PRD into actionable engineering tasks. Each task should be
 * small enough to implement in a single PR and should reference the PRD
 * acceptance criteria it satisfies.
 */
export async function generateTasks(
  input: GenerateTasksInput,
): Promise<TaskList> {
  const { prd } = input;

  const system = [
    "You are a staff engineer breaking an approved PRD into engineering tasks.",
    "Produce a concrete, ordered set of tasks that together satisfy ALL acceptance criteria.",
    "Each task should be PR-sized (implementable and reviewable on its own).",
    "Reference the acceptance-criteria ids each task helps satisfy in acceptanceRefs.",
    "Cover implementation, edge cases, and tests. Avoid vague tasks like 'implement feature'.",
  ].join("\n");

  const prompt = [
    `Feature: ${input.title}`,
    ``,
    `Problem: ${prd.problemStatement}`,
    `Goals: ${prd.goals.join("; ")}`,
    ``,
    `Acceptance criteria:`,
    ...prd.acceptanceCriteria.map((ac) => `- [${ac.id}] ${ac.text}`),
    ``,
    prd.edgeCases.length ? `Edge cases: ${prd.edgeCases.join("; ")}` : "",
  ].join("\n");

  return runStructured({ schema: TaskListSchema, system, prompt });
}
