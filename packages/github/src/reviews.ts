import { getInstallationClient } from "./app";

export interface ReviewCommentInput {
  severity: "BLOCKING" | "NON_BLOCKING";
  category: string;
  title: string;
  body: string;
  rationale: string;
  suggestion?: string | null;
  filePath?: string | null;
  line?: number | null;
}

export interface PostReviewResult {
  reviewId: number | null;
  /** Issue index → GitHub comment id, for issues posted inline. */
  inlineCommentIds: (number | null)[];
}

function formatIssue(i: ReviewCommentInput): string {
  const lines = [
    `**${i.severity === "BLOCKING" ? "🚫 Blocking" : "💡 Non-blocking"} · ${i.category}** — ${i.title}`,
    ``,
    i.body,
    ``,
    `**Why:** ${i.rationale}`,
  ];
  if (i.suggestion) lines.push(``, `**Suggestion:** ${i.suggestion}`);
  return lines.join("\n");
}

/**
 * Post the AI review to the pull request: a summary review body plus inline
 * comments where a file/line is known. Falls back to including an issue in the
 * summary body when GitHub rejects its position (line not in the diff).
 */
export async function postReview(opts: {
  installationId: string;
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
  summary: string;
  verdict: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED";
  issues: ReviewCommentInput[];
}): Promise<PostReviewResult> {
  const octokit = await getInstallationClient(opts.installationId);

  const inlineable = opts.issues.filter((i) => i.filePath && i.line && i.line > 0);
  const summaryOnly = opts.issues.filter((i) => !(i.filePath && i.line && i.line > 0));

  const blocking = opts.issues.filter((i) => i.severity === "BLOCKING").length;
  const nonBlocking = opts.issues.length - blocking;

  const bodyParts = [
    `## 🤖 ShipFlow AI review`,
    ``,
    opts.summary,
    ``,
    `**${blocking} blocking · ${nonBlocking} non-blocking**`,
  ];
  if (summaryOnly.length) {
    bodyParts.push(``, `---`, ...summaryOnly.map(formatIssue));
  }
  bodyParts.push(
    ``,
    `<sub>Reviewed against the feature's PRD and acceptance criteria by ShipFlow AI.</sub>`,
  );

  // GitHub rejects APPROVE/REQUEST_CHANGES from the app on its own PRs in some
  // cases; COMMENT is always allowed and never blocks the human reviewer.
  const event =
    opts.verdict === "CHANGES_REQUESTED"
      ? "REQUEST_CHANGES"
      : opts.verdict === "APPROVED"
        ? "APPROVE"
        : "COMMENT";

  const comments = inlineable.map((i) => ({
    path: i.filePath as string,
    line: i.line as number,
    body: formatIssue(i),
  }));

  try {
    const { data } = await octokit.rest.pulls.createReview({
      owner: opts.owner,
      repo: opts.repo,
      pull_number: opts.pullNumber,
      commit_id: opts.commitSha,
      body: bodyParts.join("\n"),
      event: event as "COMMENT" | "APPROVE" | "REQUEST_CHANGES",
      comments,
    });
    return {
      reviewId: data.id,
      inlineCommentIds: inlineable.map(() => null),
    };
  } catch {
    // Inline positions can be rejected if a line isn't part of the diff.
    // Retry with everything in the summary body so feedback still lands.
    const fallbackBody = [
      ...bodyParts,
      ...(inlineable.length ? [``, `---`, ...inlineable.map(formatIssue)] : []),
    ].join("\n");
    const { data } = await octokit.rest.pulls.createReview({
      owner: opts.owner,
      repo: opts.repo,
      pull_number: opts.pullNumber,
      commit_id: opts.commitSha,
      body: fallbackBody,
      event: "COMMENT",
    });
    return { reviewId: data.id, inlineCommentIds: inlineable.map(() => null) };
  }
}
