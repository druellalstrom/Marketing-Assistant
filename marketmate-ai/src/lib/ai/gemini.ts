import "server-only";

import { ApiError, FinishReason, GoogleGenAI, type Content, type FunctionDeclaration, type GenerateContentResponse } from "@google/genai";
import { AiGenerationError, AiNotConfiguredError, TRUNCATED_NOTE, type GenerationResult } from "./errors";
import { SYSTEM_PROMPT } from "./prompts";

/**
 * Server-only Google Gemini client. `server-only` makes the build fail if this
 * module is imported into a Client Component, so GEMINI_API_KEY never reaches
 * the browser.
 */

/** "gemini-flash-latest" tracks Google's current Flash model, which has a free tier. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MAX_OUTPUT_TOKENS = 16384;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

let client: GoogleGenAI | null = null;
export function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new AiNotConfiguredError();
  client ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      // Optional override (proxies / tests); defaults to Google's endpoint.
      ...(process.env.GEMINI_BASE_URL ? { baseUrl: process.env.GEMINI_BASE_URL } : {}),
      timeout: 110_000,
      // Retry outages, but not 429s: on the free tier each retry spends more quota.
      retryOptions: { attempts: 3, httpStatusCodes: [408, 500, 502, 503, 504] },
    },
  });
  return client;
}

const BLOCKED: string[] = [
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.RECITATION,
];

/** Maps SDK/network failures to safe messages the UI can show. */
export function mapGeminiError(err: unknown, model: string = GEMINI_MODEL, setting = "GEMINI_MODEL"): never {
  if (err instanceof ApiError) {
    // Google's own explanation (quota name, limit, model), for the server terminal only.
    console.warn(`Gemini API error ${err.status} (model ${model}): ${err.message.slice(0, 600)}`);
    // A free-tier quota of 0 means the model isn't included in the free tier at all.
    if (err.status === 429 && /limit:\s*0\b/i.test(err.message)) {
      throw new AiGenerationError(
        `Your Gemini key's free tier doesn't include the "${model}" model. Turn on billing in Google AI Studio, or set ${setting} to a model your key can use.`,
        429,
      );
    }
    if (err.status === 429) {
      throw new AiGenerationError(
        "The AI's free usage limit has been reached for now. Please wait a minute and try again.",
        429,
      );
    }
    if (err.status === 401 || err.status === 403 || (err.status === 400 && /api key/i.test(err.message))) {
      throw new AiGenerationError("The server's Gemini API key was rejected.", 502);
    }
    if (err.status === 404) {
      throw new AiGenerationError(`The AI model "${model}" isn't available. Check ${setting}.`, 502);
    }
    if (err.status >= 500) {
      throw new AiGenerationError("The AI service is busy right now. Please try again in a moment.", 503);
    }
    throw new AiGenerationError(`AI request failed (${err.status}).`, 502);
  }
  if (err instanceof AiGenerationError || err instanceof AiNotConfiguredError) throw err;
  if (err instanceof TypeError || (err instanceof Error && /fetch|network|timeout|abort/i.test(err.message))) {
    throw new AiGenerationError("Couldn't reach the AI service. Please try again.", 503);
  }
  throw err;
}

/** Throws a friendly error when Gemini blocked the prompt or the answer. */
function assertNotBlocked(response: GenerateContentResponse): void {
  if (response.promptFeedback?.blockReason) {
    throw new AiGenerationError("The AI declined this request. Try rephrasing it.", 422);
  }
  const reason = response.candidates?.[0]?.finishReason;
  if (reason && BLOCKED.includes(reason)) {
    throw new AiGenerationError("The AI declined this request. Try rephrasing it.", 422);
  }
}

export interface GeminiCallParams {
  system: string;
  contents: Content[];
  functionDeclarations?: FunctionDeclaration[];
}

/** The one place the app calls Gemini. */
export async function callGemini({ system, contents, functionDeclarations }: GeminiCallParams): Promise<GenerateContentResponse> {
  const ai = getGeminiClient();
  let response: GenerateContentResponse;
  try {
    response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: system,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        ...(functionDeclarations?.length ? { tools: [{ functionDeclarations }] } : {}),
      },
    });
  } catch (err) {
    mapGeminiError(err);
  }
  assertNotBlocked(response);
  return response;
}

export async function generateWithGemini(userPrompt: string): Promise<GenerationResult> {
  const response = await callGemini({ system: SYSTEM_PROMPT, contents: [{ role: "user", parts: [{ text: userPrompt }] }] });
  const text = (response.text ?? "").trim();
  if (!text) throw new AiGenerationError("The AI returned an empty response.", 502);
  const truncated = response.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS;
  return { text: truncated ? `${text}${TRUNCATED_NOTE}` : text, model: response.modelVersion ?? GEMINI_MODEL };
}
