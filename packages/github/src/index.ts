export { getGitHubApp, getInstallationClient } from "./app";
export {
  listInstallationRepos,
  getPrFiles,
  getRepoOverview,
  type RepoSummary,
  type PrFile,
  type RepoOverview,
} from "./repos";
export { verifyGitHubWebhook } from "./webhooks";
export {
  postReview,
  type ReviewCommentInput,
  type PostReviewResult,
} from "./reviews";
export { selectReviewableFiles } from "./diff";

/** GitHub App installation URL (users install the app here). */
export function getInstallUrl(state?: string): string {
  const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
  if (!slug) throw new Error("NEXT_PUBLIC_GITHUB_APP_SLUG is not set.");
  const url = `https://github.com/apps/${slug}/installations/new`;
  return state ? `${url}?state=${encodeURIComponent(state)}` : url;
}
