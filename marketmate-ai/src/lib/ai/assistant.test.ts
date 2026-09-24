import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

// Mock Anthropic API that replays a scripted sequence of responses.
let server: http.Server;
let script: unknown[] = [];
let requests: Record<string, unknown>[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests.push(JSON.parse(raw));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(script.shift()));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-not-real";
  process.env.AI_PROVIDER = "anthropic";
});
afterAll(() => {
  server.close();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_PROVIDER;
});
beforeEach(() => {
  requests = [];
  vi.resetModules();
});

const msg = (content: unknown[], stop_reason: string) => ({
  id: "m", type: "message", role: "assistant", model: "claude-opus-5", content, stop_reason, stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
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

describe("executePricingTool", () => {
  it("returns calculator results, not model arithmetic", async () => {
    const { executePricingTool } = await import("./assistant");
    const out = JSON.parse(executePricingTool(pricingInput).content);
    // 300 + 50 + 200 = 550 → $5.50/unit; retail 5.5/0.4 = 13.75; wholesale 5.5/0.6 = 9.17
    expect(out.totalProductionCost).toBe(550);
    expect(out.costPerUnit).toBe(5.5);
    expect(out.costBreakdownPerUnit.materials).toBe(3);
    expect(out.retail.price).toBe(13.75);
    expect(out.wholesale.price).toBe(9.17);
    expect(out.retail.breakEvenUnits).toBe(40); // 550 / 13.75
  });

  it("reports invalid input as a tool error instead of throwing", async () => {
    const { executePricingTool } = await import("./assistant");
    expect(executePricingTool({ quantity: 0 }).isError).toBe(true);
    expect(executePricingTool({ ...pricingInput, targetRetailMarginPct: 99, retailFees: { percentFee: 5, fixedFeePerSale: 0 } }).isError).toBe(true);
  });
});

describe("runAssistantTurn", () => {
  it("executes tool calls and returns the final answer", async () => {
    script = [
      msg([{ type: "text", text: "Let me calculate." }, { type: "tool_use", id: "tu_1", name: "calculate_pricing", input: pricingInput }], "tool_use"),
      msg([{ type: "text", text: "Charge about $13.75 retail." }], "end_turn"),
    ];
    const { runAssistantTurn, executePricingTool } = await import("./assistant");
    const calls: string[] = [];
    const turn = await runAssistantTurn({
      history: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello!" }],
      userMessage: "What should I charge?",
      business: { name: "Glow Co", location: "Barbados" },
      executeTool: async (name, input) => {
        calls.push(name);
        return executePricingTool(input);
      },
    });
    expect(turn.text).toBe("Charge about $13.75 retail.");
    expect(turn.toolsUsed).toEqual(["calculate_pricing"]);
    expect(calls).toEqual(["calculate_pricing"]);

    // First request: history + new message, tools declared, business in system prompt.
    const first = requests[0] as { messages: unknown[]; tools: { name: string }[]; system: string };
    expect(first.messages).toHaveLength(3);
    expect(first.tools.map((t) => t.name)).toEqual(["calculate_pricing", "update_business_profile"]);
    expect(first.system).toContain("Business name: Glow Co");

    // Second request carries the assistant tool_use turn and one tool_result message.
    const second = requests[1] as { messages: { role: string; content: { type: string; tool_use_id?: string; content?: string }[] }[] };
    const last = second.messages.at(-1)!;
    expect(last.role).toBe("user");
    expect(last.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu_1" });
    expect(JSON.parse(last.content[0].content!).retail.price).toBe(13.75);
  });

  it("stops runaway tool loops", async () => {
    script = Array.from({ length: 10 }, (_, i) =>
      msg([{ type: "tool_use", id: `tu_${i}`, name: "calculate_pricing", input: pricingInput }], "tool_use"),
    );
    const { runAssistantTurn, executePricingTool } = await import("./assistant");
    await expect(
      runAssistantTurn({ history: [], userMessage: "x", business: null, executeTool: async (_n, i) => executePricingTool(i) }),
    ).rejects.toThrow(/too many steps/);
  });
});
