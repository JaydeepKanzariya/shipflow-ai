import { runStructured } from "./model";
import { ReviewSchema, type Review, type Prd, type RepoAnalysis } from "./schemas";

export interface ReviewPrInput {
  featureTitle: string;
  prd: Prd;
  tasks: { title: string; description: string; acceptanceRefs: string[] }[];
  pr: { title: string; body: string | null; branch: string };
  /** Changed files with unified-diff patches (already size-capped). */
  files: { filename: string; status: string; patch?: string }[];
  /** Files omitted from the diff (lockfiles, generated, oversized). */
  skippedFiles: string[];
  repoAnalysis?: RepoAnalysis | null;
  /** Unresolved issues from the previous review, for re-review. */
  previousIssues?: { title: string; rationale: string; severity: string }[];
}

const SYSTEM = [
  "You are a senior QA + engineering reviewer for a production release.",
  "",
  "Your job is NOT to be a syntax checker or a linter. Judge whether the",
  "implementation actually SATISFIES THE PRODUCT REQUIREMENTS and is safe to",
  "ship. Review against: the PRD, its acceptance criteria, the planned tasks,",
  "security, performance, edge cases, and code quality.",
  "",
  "Rules:",
  "- Only report REAL problems you can justify from the diff. No nitpicking,",
  "  no speculation about code you cannot see.",
  "- Every issue MUST include a 'rationale' explaining WHY it matters (the",
  "  impact, or the requirement/criterion it violates).",
  "- BLOCKING = breaks a requirement, security flaw, data loss, or clear",
  "  correctness bug. NON_BLOCKING = quality/maintainability improvements.",
  "- For EVERY acceptance criterion, judge SATISFIED / PARTIAL / NOT_ADDRESSED",
  "  and cite evidence from the diff.",
  "- If the PR genuinely satisfies the requirements, say so and APPROVE. Do not",
  "  invent issues to seem thorough.",
  "- If the diff is unrelated to the PRD (e.g. docs only), say that plainly",
  "  rather than forcing acceptance-criteria judgements.",
].join("\n");

/**
 * Review a pull request against its feature's PRD, tasks, and the repo's
 * conventions. Returns a structured verdict, per-criterion coverage, and
 * categorized issues that each explain why they matter.
 */
export async function reviewPullRequest(input: ReviewPrInput): Promise<Review> {
  const parts: string[] = [
    `# Feature: ${input.featureTitle}`,
    ``,
    `## PRD`,
    `Problem: ${input.prd.problemStatement}`,
    `Goals: ${input.prd.goals.join("; ")}`,
    input.prd.nonGoals.length ? `Non-goals: ${input.prd.nonGoals.join("; ")}` : "",
    ``,
    `### Acceptance criteria (judge each one)`,
    ...input.prd.acceptanceCriteria.map((ac) => `- [${ac.id}] ${ac.text}`),
    input.prd.edgeCases.length
      ? `\n### Edge cases to consider\n${input.prd.edgeCases.map((e) => `- ${e}`).join("\n")}`
      : "",
  ];

  if (input.tasks.length) {
    parts.push(
      ``,
      `## Planned engineering tasks`,
      ...input.tasks.map(
        (t) =>
          `- ${t.title}${t.acceptanceRefs.length ? ` (covers ${t.acceptanceRefs.join(", ")})` : ""}`,
      ),
    );
  }

  if (input.repoAnalysis) {
    parts.push(
      ``,
      `## Repository context`,
      `Stack: ${input.repoAnalysis.stack.join(", ")}`,
      `Structure: ${input.repoAnalysis.structure}`,
      input.repoAnalysis.conventions.length
        ? `Conventions: ${input.repoAnalysis.conventions.join("; ")}`
        : "",
      input.repoAnalysis.risks.length
        ? `Known risky areas: ${input.repoAnalysis.risks.join("; ")}`
        : "",
    );
  }

  if (input.previousIssues?.length) {
    parts.push(
      ``,
      `## Unresolved issues from the previous review`,
      `Check whether this update addresses them; re-report any that remain.`,
      ...input.previousIssues.map((i) => `- [${i.severity}] ${i.title} — ${i.rationale}`),
    );
  }

  parts.push(
    ``,
    `## Pull request`,
    `Title: ${input.pr.title}`,
    `Branch: ${input.pr.branch}`,
    input.pr.body ? `Description: ${input.pr.body}` : "",
    ``,
    `## Changed files (unified diff)`,
  );

  for (const f of input.files) {
    parts.push(`\n### ${f.filename} (${f.status})`);
    parts.push(f.patch ? "```diff\n" + f.patch + "\n```" : "(no textual diff available)");
  }

  if (input.skippedFiles.length) {
    parts.push(
      ``,
      `## Files NOT included in this diff (skipped as generated/oversized)`,
      input.skippedFiles.map((f) => `- ${f}`).join("\n"),
      `Do not judge these files; note in your summary if this limits the review.`,
    );
  }

  return runStructured({
    schema: ReviewSchema,
    system: SYSTEM,
    prompt: parts.filter(Boolean).join("\n"),
  });
}
