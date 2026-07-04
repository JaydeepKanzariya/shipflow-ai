import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import type { z } from "zod";

/**
 * Central model config. Provider is isolated here so switching providers
 * (Gemini, Anthropic, etc.) later is a one-file change: swap the factory +
 * model id, keep the same runStructured() interface.
 */
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// Llama 3.3 70B on Groq: fast, free, strong enough for PRD/triage and
// supports structured (JSON) output.
export const model = groq("llama-3.3-70b-versatile");

/**
 * Generate a Zod-validated structured object from a prompt. Throws if the
 * model output doesn't satisfy the schema (the AI SDK retries internally).
 *
 * Typed against the schema's OUTPUT type (`z.infer`), i.e. after `.default()`s
 * are applied, so callers get fully-populated objects.
 */
export async function runStructured<S extends z.ZodTypeAny>(opts: {
  schema: S;
  system: string;
  prompt: string;
}): Promise<z.infer<S>> {
  const { object } = await generateObject({
    model,
    schema: opts.schema,
    system: opts.system,
    prompt: opts.prompt,
  });
  return object as z.infer<S>;
}
