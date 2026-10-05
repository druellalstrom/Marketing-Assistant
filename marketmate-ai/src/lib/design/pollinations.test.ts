import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { buildImagePrompt, DESIGN_DIMENSIONS, DESIGN_TYPES, type DesignBrief } from "./brief";
import { getImageProvider, NotConnectedProvider } from "./provider";
import { PollinationsProvider } from "./pollinations";

// A local stand-in for gen.pollinations.ai: no real key or network needed.
let server: http.Server;
let lastRequest: { url: string; headers: http.IncomingHttpHeaders } | null;
let nextResponse: { status: number; type: string; body: Buffer | string };
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

beforeAll(async () => {
  server = http.createServer((req, res) => {
    lastRequest = { url: req.url ?? "", headers: req.headers };
    res.writeHead(nextResponse.status, { "content-type": nextResponse.type });
    res.end(nextResponse.body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.POLLINATIONS_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  delete process.env.POLLINATIONS_BASE_URL;
  delete process.env.POLLINATIONS_API_KEY;
  delete process.env.IMAGE_PROVIDER;
});
beforeEach(() => {
  lastRequest = null;
  process.env.POLLINATIONS_API_KEY = "sk_test_not_real";
});

const brief: DesignBrief = {
  designType: "Instagram / TikTok story (9:16)",
  style: "Bold & colourful",
  businessName: "Glow Co",
  productName: "Vanilla candle",
  price: "$24",
  colors: { primary: "#112233", secondary: "#FFFFFF", accent: "#FF8800" },
  uploads: { logo: "user-1/logo.png" },
};

describe("PollinationsProvider", () => {
  it("sends the key as a Bearer header, sizes the image for the format, and returns the bytes", async () => {
    nextResponse = { status: 200, type: "image/png", body: PNG };
    const prompt = buildImagePrompt(brief, { includeUploads: false });
    const result = await new PollinationsProvider().generate(prompt, brief);

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.image.contentType).toBe("image/png");
    expect(Buffer.from(result.image.bytes)).toEqual(PNG);

    const url = new URL(lastRequest!.url, "http://x");
    expect(lastRequest!.headers.authorization).toBe("Bearer sk_test_not_real");
    expect(url.searchParams.has("key")).toBe(false); // key never in the URL
    expect(decodeURIComponent(url.pathname)).toBe(`/image/${prompt}`);
    expect(url.searchParams.get("width")).toBe("720");
    expect(url.searchParams.get("height")).toBe("1280");
    expect(url.searchParams.get("safe")).toBe("true");
    expect(url.searchParams.has("model")).toBe(false);
  });

  it("caps very long prompts so the URL stays valid", async () => {
    nextResponse = { status: 200, type: "image/jpeg", body: PNG };
    await new PollinationsProvider().generate("x".repeat(5000), brief);
    expect(decodeURIComponent(new URL(lastRequest!.url, "http://x").pathname)).toHaveLength("/image/".length + 1800);
  });

  it.each([
    [401, /rejected the API key/],
    [402, /out of Pollen credits/],
    [429, /wait a minute/],
    [503, /busy/],
    [400, /couldn't make an image/],
  ])("explains HTTP %i in plain language", async (status, message) => {
    nextResponse = { status, type: "application/json", body: JSON.stringify({ error: "x" }) };
    const result = await new PollinationsProvider().generate("poster", brief);
    expect(result).toMatchObject({ status: "failed", provider: "pollinations", error: expect.stringMatching(message) });
    if (result.status === "failed") expect(result.error).not.toContain("sk_test_not_real");
  });

  it("refuses non-image and SVG responses", async () => {
    for (const type of ["text/html", "image/svg+xml"]) {
      nextResponse = { status: 200, type, body: "<svg/>" };
      expect(await new PollinationsProvider().generate("poster", brief)).toMatchObject({ status: "failed" });
    }
  });

  it("reports an unreachable service", async () => {
    const saved = process.env.POLLINATIONS_BASE_URL;
    process.env.POLLINATIONS_BASE_URL = "http://127.0.0.1:1";
    try {
      expect(await new PollinationsProvider().generate("poster", brief)).toMatchObject({ status: "failed", error: expect.stringMatching(/reach/) });
    } finally {
      process.env.POLLINATIONS_BASE_URL = saved;
    }
  });
});

describe("getImageProvider", () => {
  it("uses Pollinations only when selected and a key is set", () => {
    delete process.env.IMAGE_PROVIDER;
    expect(getImageProvider()).toBeInstanceOf(NotConnectedProvider);
    process.env.IMAGE_PROVIDER = "pollinations";
    expect(getImageProvider()).toBeInstanceOf(PollinationsProvider);
    expect(getImageProvider().connected).toBe(true);
    delete process.env.POLLINATIONS_API_KEY;
    expect(getImageProvider().connected).toBe(false);
    delete process.env.IMAGE_PROVIDER;
  });
});

describe("image prompt and sizes", () => {
  it("leaves out uploads the provider can't see", () => {
    expect(buildImagePrompt(brief)).toContain("supplied logo");
    expect(buildImagePrompt(brief, { includeUploads: false })).not.toContain("supplied logo");
  });

  it("has a valid size for every format", () => {
    for (const t of DESIGN_TYPES) {
      const { width, height } = DESIGN_DIMENSIONS[t];
      expect(width % 16).toBe(0);
      expect(height % 16).toBe(0);
      expect(width * height).toBeLessThanOrEqual(1_600_000);
    }
  });
});
