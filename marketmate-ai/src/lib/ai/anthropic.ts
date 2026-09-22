import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompts";

/**
 * Server-only Anthropic client. `server-only` makes the build fail if this
 * module is ever imported into a Client Component, so ANTHROPIC_API_KEY can
 * never reach the browser bundle.
 */

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiNotConfiguredError();
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set on the server.");
    this.name = "AiNotConfiguredError";
  }
}

export class AiGenerationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AiGenerationError";
  }
}

export interface GenerationResult {
  text: string;
  model: string;
}

export async function generateMarketingText(userPrompt: string): Promise<GenerationResult> {
  const anthropic = getClient();

  let response;
  try {
    response = await anthropic.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      // If the primary model declines, the API retries on Anthropic's recommended fallback.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new AiGenerationError("The server's Anthropic API key was rejected.", 502);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AiGenerationError("The AI service is busy. Please try again in a minute.", 429);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new AiGenerationError("Couldn't reach the AI service. Please try again.", 503);
    }
    if (err instanceof Anthropic.APIError) {
      throw new AiGenerationError(`AI request failed (${err.status ?? "unknown"}).`, 502);
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new AiGenerationError(
      "The AI declined this request. Try rephrasing it.",
      422,
    );
  }

  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();

  if (!text) throw new AiGenerationError("The AI returned an empty response.", 502);

  const truncated = response.stop_reason === "max_tokens";
  return {
    text: truncated ? `${text}\n\n_(Output was cut off because it reached the length limit.)_` : text,
    model: response.model,
  };
}
