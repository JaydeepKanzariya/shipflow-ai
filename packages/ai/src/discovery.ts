import { runStructured } from "./model";
import {
  ClarificationSchema,
  PrdSchema,
  type Clarification,
  type Prd,
  type ClarifyingAnswers,
} from "./schemas";

export interface AssessInput {
  title: string;
  rawText: string;
  /** Optional context about existing product capabilities, if known. */
  productContext?: string;
}

/**
 * Discovery triage. Decides whether to clarify, educate (likely already
 * exists / shouldn't be built), or proceed to a PRD.
 */
export async function assessRequest(input: AssessInput): Promise<Clarification> {
  const system = [
    "You are a senior product manager doing discovery on an incoming feature request.",
    "Decide ONE of:",
    "- 'clarify': the request is missing context needed to write a solid PRD. Ask 2-4 focused follow-up questions.",
    "- 'educate': the capability very likely already exists in typical products of this kind, OR it shouldn't be built as described. Explain why, kindly, in educateMessage.",
    "- 'proceed': the request is clear and worth building; no questions needed.",
    "Prefer 'clarify' when genuinely unsure. Only 'educate' when you have a concrete reason.",
    "Always fill 'reasoning'. Only fill 'questions' for clarify, only 'educateMessage' for educate.",
  ].join("\n");

  const prompt = [
    `Feature request title: ${input.title}`,
    ``,
    `Request details:`,
    input.rawText,
    input.productContext ? `\nKnown product context:\n${input.productContext}` : "",
  ].join("\n");

  return runStructured({ schema: ClarificationSchema, system, prompt });
}

export interface GeneratePrdInput {
  title: string;
  rawText: string;
  answers?: ClarifyingAnswers;
}

/**
 * Generate a structured PRD from the request and any clarifying answers.
 */
export async function generatePrd(input: GeneratePrdInput): Promise<Prd> {
  const system = [
    "You are a senior product manager writing a Product Requirements Document (PRD).",
    "Produce a precise, buildable PRD. Acceptance criteria must be specific and testable,",
    "each with a stable id (ac1, ac2, ...) so engineering tasks can reference them.",
    "Include realistic edge cases and measurable success metrics. Be concrete, not generic.",
  ].join("\n");

  const answersBlock =
    input.answers && input.answers.length > 0
      ? [
          ``,
          `Clarifying Q&A:`,
          ...input.answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`),
        ].join("\n")
      : "";

  const prompt = [
    `Feature request title: ${input.title}`,
    ``,
    `Request details:`,
    input.rawText,
    answersBlock,
  ].join("\n");

  return runStructured({ schema: PrdSchema, system, prompt });
}
