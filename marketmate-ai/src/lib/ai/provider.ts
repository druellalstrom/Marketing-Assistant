import "server-only";

import { generateMarketingText as generateWithAnthropic, isAnthropicConfigured } from "./anthropic";
import { AiNotConfiguredError, type GenerationResult } from "./errors";
import { generateWithGemini, isGeminiConfigured } from "./gemini";

export type AiProvider = "gemini" | "anthropic";

/**
 * Which AI provider writes content. AI_PROVIDER ("gemini" | "anthropic") picks
 * one explicitly; otherwise Gemini is used when GEMINI_API_KEY is set, then
 * Anthropic when ANTHROPIC_API_KEY is set.
 */
export function activeProvider(): AiProvider | null {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === "gemini") return isGeminiConfigured() ? "gemini" : null;
  if (forced === "anthropic") return isAnthropicConfigured() ? "anthropic" : null;
  if (isGeminiConfigured()) return "gemini";
  if (isAnthropicConfigured()) return "anthropic";
  return null;
}

export function isAiConfigured(): boolean {
  return activeProvider() !== null;
}

export function aiProviderLabel(): string {
  const p = activeProvider();
  return p === "gemini" ? "Google Gemini" : p === "anthropic" ? "Anthropic" : "not connected";
}

export async function generateMarketingText(userPrompt: string): Promise<GenerationResult> {
  const provider = activeProvider();
  if (provider === "gemini") return generateWithGemini(userPrompt);
  if (provider === "anthropic") return generateWithAnthropic(userPrompt);
  throw new AiNotConfiguredError();
}
