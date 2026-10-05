import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { DesignBrief } from "./brief";

// A local stand-in for the Gemini API: no real key or network needed.
let server: http.Server;
let requests: { url: string; body: Record<string, unknown> }[] = [];
let nextResponse: { status: number; body: unknown };
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests.push({ url: req.url ?? "", body: JSON.parse(raw || "{}") });
      res.writeHead(nextResponse.status, { "content-type": "application/json" });
      res.end(JSON.stringify(nextResponse.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.GEMINI_API_KEY = "gemini-test-not-real";
});
afterAll(() => {
  server.close();
  delete process.env.GEMINI_BASE_URL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.IMAGE_PROVIDER;
});
beforeEach(() => {
  requests = [];
  vi.resetModules();
});

const brief: DesignBrief = {
  designType: "Promotional poster",
  style: "Bold & colourful",
  businessName: "Glow Co",
  productName: "Vanilla candle",
  colors: { primary: "#112233", secondary: "#FFFFFF", accent: "#FF8800" },
  uploads: {},
};
const withImage = (mimeType = "image/png", finishReason = "STOP") => ({
  status: 200,
  body: { candidates: [{ content: { role: "model", parts: [{ text: "Here is your poster." }, { inlineData: { mimeType, data: PNG.toString("base64") } }] }, finishReason }] },
});

describe("GeminiImageProvider", () => {
  it("asks for an image in the format's aspect ratio and returns the bytes", async () => {
    nextResponse = withImage();
    const { GeminiImageProvider } = await import("./gemini-image");
    const result = await new GeminiImageProvider().generate("Poster for Glow Co", brief);

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.image.contentType).toBe("image/png");
    expect(Buffer.from(result.image.bytes)).toEqual(PNG);

    const req = requests[0];
    expect(req.url).toContain("/models/gemini-2.5-flash-image:generateContent");
    expect(req.body.generationConfig).toMatchObject({ responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "3:4" } });
  });

  it("sends uploaded images, each labelled with its role", async () => {
    nextResponse = withImage();
    const { GeminiImageProvider } = await import("./gemini-image");
    await new GeminiImageProvider().generate("Poster", brief, [
      { role: "logo", bytes: new Uint8Array(PNG), contentType: "image/png" },
      { role: "productPhoto", bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" },
    ]);
    const parts = (requests[0].body.contents as { parts: Record<string, unknown>[] }[])[0].parts;
    expect(parts[0]).toEqual({ text: "Poster" });
    expect(parts[1].text).toMatch(/logo/);
    expect(parts[2]).toEqual({ inlineData: { mimeType: "image/png", data: PNG.toString("base64") } });
    expect(parts[3].text).toMatch(/product photo/);
    expect(parts[4]).toEqual({ inlineData: { mimeType: "image/jpeg", data: Buffer.from([1, 2, 3]).toString("base64") } });
  });

  it("reports a reply with no image", async () => {
    nextResponse = { status: 200, body: { candidates: [{ content: { role: "model", parts: [{ text: "I can't." }] }, finishReason: "STOP" }] } };
    const { GeminiImageProvider } = await import("./gemini-image");
    expect(await new GeminiImageProvider().generate("x", brief)).toMatchObject({ status: "failed", error: expect.stringMatching(/didn't return an image/) });
  });

  it("reports safety refusals", async () => {
    nextResponse = { status: 200, body: { candidates: [{ content: { role: "model", parts: [] }, finishReason: "IMAGE_SAFETY" }] } };
    const { GeminiImageProvider } = await import("./gemini-image");
    expect(await new GeminiImageProvider().generate("x", brief)).toMatchObject({ status: "failed", error: expect.stringMatching(/declined/) });
  });

  it("refuses SVG output", async () => {
    nextResponse = withImage("image/svg+xml");
    const { GeminiImageProvider } = await import("./gemini-image");
    expect(await new GeminiImageProvider().generate("x", brief)).toMatchObject({ status: "failed" });
  });

  it("explains when the model isn't in the key's free tier", async () => {
    nextResponse = {
      status: 429,
      body: { error: { code: 429, message: "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-2.5-flash-image", status: "RESOURCE_EXHAUSTED" } },
    };
    const { GeminiImageProvider } = await import("./gemini-image");
    const result = await new GeminiImageProvider().generate("x", brief);
    expect(result).toMatchObject({ status: "failed", error: expect.stringMatching(/free tier doesn't include the "gemini-2.5-flash-image" model.*GEMINI_IMAGE_MODEL/) });
  }, 20_000);

  it("explains an ordinary rate limit", async () => {
    nextResponse = { status: 429, body: { error: { code: 429, message: "Resource has been exhausted", status: "RESOURCE_EXHAUSTED" } } };
    const { GeminiImageProvider } = await import("./gemini-image");
    expect(await new GeminiImageProvider().generate("x", brief)).toMatchObject({ status: "failed", error: expect.stringMatching(/wait a minute/) });
  }, 20_000);
});

describe("getImageProvider", () => {
  it("uses Gemini when selected and the Gemini key is set", async () => {
    process.env.IMAGE_PROVIDER = "gemini";
    const { getImageProvider } = await import("./provider");
    expect(getImageProvider()).toMatchObject({ id: "gemini", label: "Google Gemini", connected: true, usesUploads: true });
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(getImageProvider().connected).toBe(false);
    process.env.GEMINI_API_KEY = saved;
    delete process.env.IMAGE_PROVIDER;
  });
});
