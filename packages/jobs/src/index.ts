import { featureClarify } from "./functions/feature-clarify";
import { prdGenerate } from "./functions/prd-generate";
import { tasksGenerate } from "./functions/tasks-generate";
import { repoAnalyze } from "./functions/repo-analyze";
import { prAiReview } from "./functions/pr-ai-review";

export { inngest, type ShipflowEvents } from "./client";

/** All workflow functions, registered by the /api/inngest serve endpoint. */
export const functions = [
  featureClarify,
  prdGenerate,
  tasksGenerate,
  repoAnalyze,
  prAiReview,
];
