/** Provider-neutral AI errors with safe, user-facing messages. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not connected: set GEMINI_API_KEY (or ANTHROPIC_API_KEY) on the server.");
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

export const TRUNCATED_NOTE = "\n\n_(Output was cut off because it reached the length limit.)_";
