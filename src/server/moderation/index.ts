import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "@/server/config/env";
import { ClaudePromptClassifier, type PromptClassifier } from "./classifier";

let classifier: PromptClassifier | null | undefined;

// Null without ANTHROPIC_API_KEY: only the local checks run, and the admin panel says so.
export function getPromptClassifier(): PromptClassifier | null {
  if (classifier !== undefined) return classifier;
  const env = getEnv();
  classifier = env.ANTHROPIC_API_KEY
    ? new ClaudePromptClassifier(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), env.MODERATION_MODEL)
    : null;
  return classifier;
}
