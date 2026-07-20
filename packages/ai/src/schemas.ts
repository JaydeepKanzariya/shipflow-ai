import { z } from "zod";

/**
 * Output of the discovery triage (assessRequest). The agent decides whether
 * the request needs clarification, is likely already solved (educate), or is
 * clear enough to proceed straight to a PRD.
 */
export const ClarificationSchema = z.object({
  decision: z.enum(["clarify", "educate", "proceed"]),
  reasoning: z
    .string()
    .describe("Short explanation of why this decision was made."),
  // Present when decision === "clarify": follow-up questions to gather context.
  questions: z
    .array(
      z.object({
        id: z.string().describe("Stable id, e.g. 'q1'."),
        question: z.string(),
        why: z.string().describe("Why this answer matters for the PRD."),
      }),
    )
    .default([]),
  // Present when decision === "educate": explain what likely already exists.
  educateMessage: z
    .string()
    .default("")
    .describe(
      "If the capability may already exist or shouldn't be built, explain to the user (with reasoning). Empty otherwise.",
    ),
});
export type Clarification = z.infer<typeof ClarificationSchema>;

const UserStorySchema = z.object({
  as: z.string().describe("The persona, e.g. 'a product manager'."),
  want: z.string().describe("What they want to do."),
  soThat: z.string().describe("The benefit / outcome."),
});

const AcceptanceCriterionSchema = z.object({
  id: z.string().describe("Stable id, e.g. 'ac1'. Tasks reference these."),
  text: z.string().describe("A single, testable acceptance criterion."),
});

/**
 * A structured Product Requirements Document. Mirrors the Prd model's JSON
 * columns so the AI output maps 1:1 onto storage.
 */
export const PrdSchema = z.object({
  problemStatement: z.string(),
  goals: z.array(z.string()).min(1),
  nonGoals: z.array(z.string()).default([]),
  userStories: z.array(UserStorySchema).min(1),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1),
  edgeCases: z.array(z.string()).default([]),
  successMetrics: z.array(z.string()).default([]),
});
export type Prd = z.infer<typeof PrdSchema>;

/** Clarifying Q&A collected from the user, fed back into PRD generation. */
export const ClarifyingAnswersSchema = z.array(
  z.object({
    question: z.string(),
    answer: z.string(),
  }),
);
export type ClarifyingAnswers = z.infer<typeof ClarifyingAnswersSchema>;

/**
 * Engineering tasks broken out of a PRD. Each task references the PRD
 * acceptance-criteria ids it helps satisfy, so coverage is traceable.
 */
export const TaskListSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().describe("Short, imperative task title."),
        description: z
          .string()
          .describe("What to build and any technical notes. 1-4 sentences."),
        acceptanceRefs: z
          .array(z.string())
          .default([])
          .describe("PRD acceptance-criteria ids this task helps satisfy (e.g. ['ac1'])."),
      }),
    )
    .min(1),
});
export type TaskList = z.infer<typeof TaskListSchema>;

/**
 * AI analysis of a connected repository — grounds later PR reviews in the
 * repo's actual stack and conventions.
 */
export const RepoAnalysisSchema = z.object({
  summary: z.string().describe("2-4 sentence overview of what this repo is."),
  stack: z.array(z.string()).describe("Languages, frameworks, key libraries."),
  structure: z
    .string()
    .describe("How the codebase is organized (folders, apps, packages)."),
  conventions: z
    .array(z.string())
    .default([])
    .describe("Observable conventions: naming, testing, patterns."),
  entryPoints: z
    .array(z.string())
    .default([])
    .describe("Key files/paths where changes usually start."),
  risks: z
    .array(z.string())
    .default([])
    .describe("Fragile or risky areas a reviewer should watch."),
});
export type RepoAnalysis = z.infer<typeof RepoAnalysisSchema>;

/** Review dimensions required by the spec. */
export const ISSUE_CATEGORIES = [
  "PRD",
  "ACCEPTANCE",
  "SECURITY",
  "PERFORMANCE",
  "EDGE_CASE",
  "QUALITY",
] as const;

/**
 * Output of the QA/engineering review of a pull request. The reviewer judges
 * whether the implementation satisfies the product requirements — not just
 * whether the code is syntactically fine.
 */
export const ReviewSchema = z.object({
  summary: z
    .string()
    .describe(
      "2-5 sentences: what this PR does and whether it satisfies the PRD. Plain, specific language.",
    ),
  verdict: z
    .enum(["APPROVED", "CHANGES_REQUESTED", "COMMENTED"])
    .describe(
      "APPROVED only when no blocking issues remain and the acceptance criteria are met.",
    ),
  /** Per-acceptance-criterion judgement — makes "meets the PRD" concrete. */
  acceptanceCoverage: z
    .array(
      z.object({
        id: z.string().describe("PRD acceptance criterion id, e.g. 'ac1'."),
        status: z.enum(["SATISFIED", "PARTIAL", "NOT_ADDRESSED"]),
        evidence: z
          .string()
          .describe("Why you judged it that way — cite files/changes from the diff."),
      }),
    )
    .default([]),
  issues: z
    .array(
      z.object({
        severity: z
          .enum(["BLOCKING", "NON_BLOCKING"])
          .describe(
            "BLOCKING = must fix before release (breaks a requirement, security, data loss, correctness). NON_BLOCKING = worth improving.",
          ),
        category: z.enum(ISSUE_CATEGORIES),
        title: z.string().describe("Short, specific problem statement."),
        body: z.string().describe("What is wrong, concretely."),
        rationale: z
          .string()
          .describe(
            "WHY this is a problem — the impact or requirement it violates. Required.",
          ),
        suggestion: z
          .string()
          .default("")
          .describe("Concrete fix, if you have one."),
        filePath: z
          .string()
          .default("")
          .describe("File from the diff this applies to, if applicable."),
        line: z
          .number()
          .int()
          .nullable()
          .default(null)
          .describe("Line number in the new file, if applicable."),
      }),
    )
    .default([]),
});
export type Review = z.infer<typeof ReviewSchema>;
