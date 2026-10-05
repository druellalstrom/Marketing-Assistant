import "server-only";

import {
  ApiError,
  FinishReason,
  GoogleGenAI,
  type Content,
  type FunctionDeclaration,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";
import { AiGenerationError, AiNotConfiguredError, TRUNCATED_NOTE, type GenerationResult } from "./errors";
import { SYSTEM_PROMPT } from "./prompts";

/**
 * Server-only Google Gemini client. `server-only` makes the build fail if this
 * module is imported into a Client Component, so GEMINI_API_KEY never reaches
 * the browser.
 */

/** "gemini-flash-latest" tracks Google's current Flash model, which has a free tier. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

/**
 * Models tried in order when one is overloaded, unavailable or out of free
 * quota (Google's free limits are per model). GEMINI_FALLBACK_MODELS
 * (comma-separated) replaces the default backups.
 */
export const GEMINI_MODELS = modelChain(GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODELS, [
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
]);

export function modelChain(primary: string, override: string | undefined, defaults: string[]): string[] {
  const backups = override !== undefined ? override.split(",").map((m) => m.trim()).filter(Boolean) : defaults;
  return [...new Set([primary, ...backups])];
}
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
      // One quick retry for outages; after that, backup models are tried instead.
      // 429s aren't retried: on the free tier each retry spends more quota.
      retryOptions: { attempts: 2, httpStatusCodes: [408, 500, 502, 503, 504] },
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
export function mapGeminiError(err: unknown, model: string = GEMINI_MODEL, setting = "GEMINI_MODEL", log = true): never {
  if (err instanceof ApiError) {
    // Google's own explanation (quota name, limit, model), for the server terminal only.
    if (log) console.warn(`Gemini API error ${err.status} (model ${model}): ${err.message.slice(0, 600)}`);
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

/** Errors where a different model may still succeed: overload/outage, unknown model, per-model quota. */
function worthTryingAnotherModel(err: unknown): boolean {
  return err instanceof ApiError && (err.status >= 500 || err.status === 404 || err.status === 429);
}

/**
 * Calls generateContent on each model in turn until one answers. Returns the
 * response and the model that produced it.
 */
export async function generateWithFallback(
  models: string[],
  request: Omit<GenerateContentParameters, "model">,
  setting = "GEMINI_MODEL",
): Promise<{ response: GenerateContentResponse; model: string }> {
  const ai = getGeminiClient();
  let lastError: unknown;
  for (const model of models) {
    try {
      return { response: await ai.models.generateContent({ ...request, model }), model };
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError) console.warn(`Gemini API error ${err.status} (model ${model}): ${err.message.slice(0, 600)}`);
      if (!worthTryingAnotherModel(err)) break;
    }
  }
  if (models.length > 1 && lastError instanceof ApiError && worthTryingAnotherModel(lastError)) {
    // Every model failed; describe the last failure without blaming one model.
    if (lastError.status === 429) {
      throw new AiGenerationError(
        /limit:\s*0\b/i.test(lastError.message)
          ? `Your Gemini key's free tier doesn't cover any of the models tried (${models.join(", ")}). Turn on billing in Google AI Studio, or set ${setting} to a model your key can use.`
          : "The AI's free usage limit has been reached for now on every available model. Please wait a minute and try again.",
        429,
      );
    }
    if (lastError.status === 404) throw new AiGenerationError(`None of the AI models tried are available. Check ${setting}.`, 502);
    throw new AiGenerationError("Google's AI is overloaded right now, including the backup models. Please try again in a few minutes.", 503);
  }
  mapGeminiError(lastError, models[0], setting, false);
}

/**
 * The one place the app calls Gemini for text. `models` pins a model (the
 * assistant keeps one model for a whole multi-step turn).
 */
export async function callGemini(
  { system, contents, functionDeclarations }: GeminiCallParams,
  models: string[] = GEMINI_MODELS,
): Promise<{ response: GenerateContentResponse; model: string }> {
  const result = await generateWithFallback(models, {
    contents,
    config: {
      systemInstruction: system,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      ...(functionDeclarations?.length ? { tools: [{ functionDeclarations }] } : {}),
    },
  });
  assertNotBlocked(result.response);
  return result;
}

export async function generateWithGemini(userPrompt: string): Promise<GenerationResult> {
  const { response } = await callGemini({ system: SYSTEM_PROMPT, contents: [{ role: "user", parts: [{ text: userPrompt }] }] });
  const text = (response.text ?? "").trim();
  if (!text) throw new AiGenerationError("The AI returned an empty response.", 502);
  const truncated = response.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS;
  return { text: truncated ? `${text}${TRUNCATED_NOTE}` : text, model: response.modelVersion ?? GEMINI_MODEL };
}
