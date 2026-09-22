import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

// A local stand-in for the Anthropic API so we can check exactly what we send
// and how responses are handled — no real key or network needed.
let server: http.Server;
let lastRequest: { headers: http.IncomingHttpHeaders; body: Record<string, unknown> } | null;
let nextResponse: { status: number; body: unknown };

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      lastRequest = { headers: req.headers, body: JSON.parse(raw || "{}") };
      res.writeHead(nextResponse.status, { "content-type": "application/json" });
      res.end(JSON.stringify(nextResponse.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-not-real";
});

afterAll(() => {
  server.close();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
});

beforeEach(() => {
  lastRequest = null;
  vi.resetModules();
});

const message = (content: unknown[], stop_reason = "end_turn") => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-opus-5",
  content,
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 20 },
});

describe("generateMarketingText", () => {
  it("sends the expected request and returns the text", async () => {
    nextResponse = { status: 200, body: message([{ type: "text", text: "Option 1: Hello!" }]) };
    const { generateMarketingText } = await import("./anthropic");
    const result = await generateMarketingText("Write a caption");

    expect(result).toEqual({ text: "Option 1: Hello!", model: "claude-opus-5" });
    expect(lastRequest?.headers["x-api-key"]).toBe("sk-ant-test-not-real");
    expect(lastRequest?.headers["anthropic-beta"]).toContain("server-side-fallback-2026-07-01");
    expect(lastRequest?.body).toMatchObject({
      model: "claude-opus-5",
      max_tokens: 16000,
      fallbacks: "default",
      messages: [{ role: "user", content: "Write a caption" }],
    });
    expect(String(lastRequest?.body.system)).toContain("MarketMate AI");
  });

  it("ignores non-text blocks such as thinking", async () => {
    nextResponse = {
      status: 200,
      body: message([{ type: "thinking", thinking: "", signature: "x" }, { type: "text", text: "Done" }]),
    };
    const { generateMarketingText } = await import("./anthropic");
    expect((await generateMarketingText("x")).text).toBe("Done");
  });

  it("turns a refusal into a clear error", async () => {
    nextResponse = { status: 200, body: message([], "refusal") };
    const { generateMarketingText, AiGenerationError } = await import("./anthropic");
    await expect(generateMarketingText("x")).rejects.toBeInstanceOf(AiGenerationError);
    await expect(generateMarketingText("x")).rejects.toMatchObject({ status: 422 });
  });

  it("flags truncated output", async () => {
    nextResponse = { status: 200, body: message([{ type: "text", text: "Partial" }], "max_tokens") };
    const { generateMarketingText } = await import("./anthropic");
    expect((await generateMarketingText("x")).text).toMatch(/cut off/);
  });

  it("maps an invalid key to a safe error without leaking details", async () => {
    nextResponse = {
      status: 401,
      body: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
    };
    const { generateMarketingText } = await import("./anthropic");
    await expect(generateMarketingText("x")).rejects.toMatchObject({
      status: 502,
      message: "The server's Anthropic API key was rejected.",
    });
  });

  it("turns overloaded/server errors into a friendly retryable message", async () => {
    nextResponse = { status: 529, body: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } } };
    const { generateMarketingText } = await import("./anthropic");
    await expect(generateMarketingText("x")).rejects.toMatchObject({
      status: 503,
      message: "The AI service is busy right now. Please try again in a moment.",
    });
  }, 30000);

  it("refuses to run without a key", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const { generateMarketingText, AiNotConfiguredError, isAnthropicConfigured } = await import("./anthropic");
    expect(isAnthropicConfigured()).toBe(false);
    await expect(generateMarketingText("x")).rejects.toBeInstanceOf(AiNotConfiguredError);
    process.env.ANTHROPIC_API_KEY = saved;
  });
});
