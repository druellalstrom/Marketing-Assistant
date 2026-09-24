import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

// A local stand-in for the Gemini API: replays scripted responses and records
// requests, so no real key or network is needed.
let server: http.Server;
let script: { status: number; body: unknown }[] = [];
let requests: { url: string; headers: http.IncomingHttpHeaders; body: Record<string, unknown> }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests.push({ url: req.url ?? "", headers: req.headers, body: JSON.parse(raw || "{}") });
      const next = script.length > 1 ? script.shift()! : script[0];
      res.writeHead(next.status, { "content-type": "application/json" });
      res.end(JSON.stringify(next.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.GEMINI_API_KEY = "gemini-test-not-real";
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_PROVIDER;
});

afterAll(() => {
  server.close();
  delete process.env.GEMINI_BASE_URL;
  delete process.env.GEMINI_API_KEY;
});

beforeEach(() => {
  requests = [];
  vi.resetModules();
});

const ok = (parts: unknown[], finishReason = "STOP") => ({
  status: 200,
  body: { candidates: [{ content: { role: "model", parts }, finishReason }], modelVersion: "gemini-test-001" },
});
const apiError = (status: number, message: string) => ({ status, body: { error: { code: status, message, status: "ERR" } } });

describe("generateWithGemini", () => {
  it("sends the key in a header and the system prompt as systemInstruction", async () => {
    script = [ok([{ text: "Option 1: Hello!" }])];
    const { generateWithGemini } = await import("./gemini");
    const result = await generateWithGemini("Write a caption");

    expect(result).toEqual({ text: "Option 1: Hello!", model: "gemini-test-001" });
    const req = requests[0];
    expect(req.url).toContain("/models/gemini-flash-latest:generateContent");
    expect(req.url).not.toContain("gemini-test-not-real"); // key never in the URL
    expect(req.headers["x-goog-api-key"]).toBe("gemini-test-not-real");
    expect(req.body.contents).toEqual([{ role: "user", parts: [{ text: "Write a caption" }] }]);
    const instruction = JSON.stringify(req.body.systemInstruction);
    expect(instruction).toMatch(/viral/i);
    expect(req.body.generationConfig).toMatchObject({ maxOutputTokens: 16384 });
    expect(req.body.tools).toBeUndefined();
  });

  it("notes when output was cut off at the length limit", async () => {
    script = [ok([{ text: "Partial plan" }], "MAX_TOKENS")];
    const { generateWithGemini } = await import("./gemini");
    const { text } = await generateWithGemini("Write a plan");
    expect(text).toMatch(/^Partial plan/);
    expect(text).toContain("cut off");
  });

  it("reports blocked responses as a friendly 422", async () => {
    script = [ok([], "SAFETY")];
    const { generateWithGemini } = await import("./gemini");
    await expect(generateWithGemini("x")).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/declined/) });

    vi.resetModules();
    script = [{ status: 200, body: { promptFeedback: { blockReason: "OTHER" } } }];
    const again = await import("./gemini");
    await expect(again.generateWithGemini("x")).rejects.toMatchObject({ status: 422 });
  });

  it("rejects an empty reply", async () => {
    script = [ok([{ text: "   " }])];
    const { generateWithGemini } = await import("./gemini");
    await expect(generateWithGemini("x")).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/empty/) });
  });

  it("explains the free-tier rate limit after retrying", async () => {
    script = [apiError(429, "Resource has been exhausted")];
    const { generateWithGemini } = await import("./gemini");
    await expect(generateWithGemini("x")).rejects.toMatchObject({
      status: 429,
      message: expect.stringMatching(/free usage limit.*wait a minute/),
    });
    expect(requests.length).toBe(3);
  }, 20_000);

  it("maps a rejected key without leaking it", async () => {
    script = [apiError(400, "API key not valid. Please pass a valid API key.")];
    const { generateWithGemini } = await import("./gemini");
    const err = await generateWithGemini("x").catch((e: Error) => e);
    expect(err).toMatchObject({ status: 502, message: "The server's Gemini API key was rejected." });
    expect(String((err as Error).message)).not.toContain("gemini-test-not-real");
  });

  it("throws AiNotConfiguredError without a key", async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const { generateWithGemini } = await import("./gemini");
      await expect(generateWithGemini("x")).rejects.toThrow(/not connected/);
      expect(requests).toHaveLength(0);
    } finally {
      process.env.GEMINI_API_KEY = saved;
    }
  });
});

describe("provider selection", () => {
  it("prefers Gemini, honours AI_PROVIDER, and reports not connected", async () => {
    const { activeProvider, aiProviderLabel } = await import("./provider");
    expect(activeProvider()).toBe("gemini");
    expect(aiProviderLabel()).toBe("Google Gemini");

    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(activeProvider()).toBe("gemini");
    process.env.AI_PROVIDER = "anthropic";
    expect(activeProvider()).toBe("anthropic");
    delete process.env.ANTHROPIC_API_KEY;
    expect(activeProvider()).toBeNull(); // forced provider without its key
    delete process.env.AI_PROVIDER;

    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(activeProvider()).toBeNull();
    expect(aiProviderLabel()).toBe("not connected");
    process.env.GEMINI_API_KEY = saved;
  });

  it("routes generateMarketingText to Gemini", async () => {
    script = [ok([{ text: "From Gemini" }])];
    const { generateMarketingText } = await import("./provider");
    expect((await generateMarketingText("x")).text).toBe("From Gemini");
    expect(requests).toHaveLength(1);
  });
});

const pricingInput = {
  quantity: 100,
  costs: {
    materials: { amount: 300, basis: "total" },
    packaging: { amount: 0.5, basis: "per_unit" },
    labor: { amount: 200, basis: "total" },
    transportation: { amount: 0, basis: "total" },
    electricity: { amount: 0, basis: "total" },
    marketing: { amount: 0, basis: "total" },
    other: { amount: 0, basis: "total" },
  },
  targetRetailMarginPct: 60,
  targetWholesaleMarginPct: 40,
  retailFees: { percentFee: 0, fixedFeePerSale: 0 },
};

describe("runAssistantTurn on Gemini", () => {
  it("runs function calls through the real calculator and returns the answer", async () => {
    const modelTurn = [
      { text: "Let me calculate." },
      { functionCall: { id: "fc_1", name: "calculate_pricing", args: pricingInput }, thoughtSignature: "c2ln" },
    ];
    script = [ok(modelTurn), ok([{ text: "Charge about $13.75 retail." }])];
    const { runAssistantTurn, executePricingTool } = await import("./assistant");
    const turn = await runAssistantTurn({
      history: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello!" }],
      userMessage: "What should I charge?",
      business: { name: "Glow Co", location: "Barbados" },
      executeTool: async (_name, input) => executePricingTool(input),
    });
    expect(turn).toMatchObject({ text: "Charge about $13.75 retail.", toolsUsed: ["calculate_pricing"] });

    // First request: history mapped to user/model roles, functions declared, business in the system instruction.
    const first = requests[0].body as {
      contents: { role: string }[];
      tools: { functionDeclarations: { name: string; parametersJsonSchema: unknown }[] }[];
      systemInstruction: unknown;
    };
    expect(first.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(first.tools[0].functionDeclarations.map((f) => f.name)).toEqual(["calculate_pricing", "update_business_profile"]);
    expect(first.tools[0].functionDeclarations[0].parametersJsonSchema).toBeTruthy();
    expect(JSON.stringify(first.systemInstruction)).toContain("Business name: Glow Co");

    // Second request echoes the model turn unchanged (thought signature kept) and returns the function result.
    const second = requests[1].body as { contents: { role: string; parts: Record<string, unknown>[] }[] };
    expect(second.contents.at(-2)).toEqual({ role: "model", parts: modelTurn });
    const reply = second.contents.at(-1)!;
    expect(reply.role).toBe("user");
    const fr = reply.parts[0].functionResponse as { id: string; name: string; response: { output: string } };
    expect(fr).toMatchObject({ id: "fc_1", name: "calculate_pricing" });
    expect(JSON.parse(fr.response.output).retail.price).toBe(13.75);
  });

  it("sends tool errors back as errors", async () => {
    script = [
      ok([{ functionCall: { name: "calculate_pricing", args: { quantity: 0 } } }]),
      ok([{ text: "I need your quantity." }]),
    ];
    const { runAssistantTurn, executePricingTool } = await import("./assistant");
    const turn = await runAssistantTurn({ history: [], userMessage: "price?", business: null, executeTool: async (_n, i) => executePricingTool(i) });
    expect(turn.text).toBe("I need your quantity.");
    const fr = (requests[1].body as { contents: { parts: { functionResponse: { response: Record<string, string> } }[] }[] })
      .contents.at(-1)!.parts[0].functionResponse;
    expect(fr.response.error).toMatch(/Invalid pricing input/);
  });

  it("stops runaway tool loops", async () => {
    script = [ok([{ functionCall: { name: "calculate_pricing", args: pricingInput } }])];
    const { runAssistantTurn, executePricingTool } = await import("./assistant");
    await expect(
      runAssistantTurn({ history: [], userMessage: "x", business: null, executeTool: async (_n, i) => executePricingTool(i) }),
    ).rejects.toThrow(/too many steps/);
    expect(requests).toHaveLength(6);
  });
});
