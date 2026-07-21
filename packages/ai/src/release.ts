import { runStructured } from "./model";
import {
  ReleaseReadinessSchema,
  type ReleaseReadiness,
  type Prd,
} from "./schemas";

export interface ReleaseReadinessInput {
  featureTitle: string;
  prd: Prd;
  tasks: { title: string; status: string }[];
  pullRequests: { number: number; title: string; state: string }[];
  reviews: {
    verdict: string;
    summary: string | null;
    createdAt: string;
    blockingCount: number;
    nonBlockingCount: number;
  }[];
  openIssues: {
    severity: string;
    category: string;
    title: string;
    rationale: string;
  }[];
  acceptanceCoverage: { id: string; status: string; evidence: string }[];
}

/**
 * Summarize whether a feature is ready to release, for the human approver.
 * Advisory: the platform never ships on this verdict alone.
 */
export async function assessReleaseReadiness(
  input: ReleaseReadinessInput,
): Promise<ReleaseReadiness> {
  const system = [
    "You are preparing a release-readiness brief for a human approver.",
    "Weigh the PRD's acceptance criteria, the engineering tasks, the pull",
    "requests, the AI review history, and any unresolved issues.",
    "",
    "Rules:",
    "- NOT_READY if any BLOCKING issue is unresolved or any acceptance",
    "  criterion is unmet.",
    "- READY_WITH_RISKS if it works but carries non-blocking concerns worth",
    "  naming.",
    "- READY only when the requirements are met and nothing blocking remains.",
    "- Be specific and honest. A human decides — your job is to give them the",
    "  facts, including anything you could not verify.",
  ].join("\n");

  const prompt = [
    `# Feature: ${input.featureTitle}`,
    ``,
    `## Acceptance criteria`,
    ...input.prd.acceptanceCriteria.map((ac) => `- [${ac.id}] ${ac.text}`),
    ``,
    `## Latest acceptance coverage (from AI review)`,
    input.acceptanceCoverage.length
      ? input.acceptanceCoverage
          .map((c) => `- ${c.id}: ${c.status} — ${c.evidence}`)
          .join("\n")
      : "(no coverage recorded)",
    ``,
    `## Tasks`,
    input.tasks.length
      ? input.tasks.map((t) => `- [${t.status}] ${t.title}`).join("\n")
      : "(none)",
    ``,
    `## Pull requests`,
    input.pullRequests.length
      ? input.pullRequests
          .map((p) => `- #${p.number} ${p.title} (${p.state})`)
          .join("\n")
      : "(none)",
    ``,
    `## AI review history (newest first)`,
    input.reviews.length
      ? input.reviews
          .map(
            (r) =>
              `- ${r.createdAt}: ${r.verdict} — ${r.blockingCount} blocking, ${r.nonBlockingCount} non-blocking. ${r.summary ?? ""}`,
          )
          .join("\n")
      : "(no reviews yet)",
    ``,
    `## Unresolved issues`,
    input.openIssues.length
      ? input.openIssues
          .map((i) => `- [${i.severity}/${i.category}] ${i.title} — ${i.rationale}`)
          .join("\n")
      : "(none)",
  ].join("\n");

  return runStructured({ schema: ReleaseReadinessSchema, system, prompt });
}
