import { runStructured } from "./model";
import { RepoAnalysisSchema, type RepoAnalysis } from "./schemas";

export interface AnalyzeRepoInput {
  fullName: string;
  description: string | null;
  languages: string[];
  /** File paths from the repo tree (already capped upstream). */
  tree: string[];
  keyFiles: { path: string; content: string }[];
}

/**
 * Summarize a repository's stack, structure, and conventions from its tree
 * and key manifest files. Grounds PR reviews (M6) in repo reality.
 */
export async function analyzeRepo(input: AnalyzeRepoInput): Promise<RepoAnalysis> {
  const system = [
    "You are a staff engineer onboarding onto an unfamiliar repository.",
    "From the file tree and manifests, infer the stack, structure, conventions,",
    "likely entry points for changes, and risky areas. Be concrete and terse;",
    "only state what the evidence supports.",
  ].join("\n");

  const prompt = [
    `Repository: ${input.fullName}`,
    input.description ? `Description: ${input.description}` : "",
    `Languages: ${input.languages.join(", ") || "unknown"}`,
    ``,
    `File tree (truncated):`,
    input.tree.slice(0, 300).join("\n"),
    ``,
    ...input.keyFiles.map((f) => `--- ${f.path} ---\n${f.content}`),
  ].join("\n");

  return runStructured({ schema: RepoAnalysisSchema, system, prompt });
}
