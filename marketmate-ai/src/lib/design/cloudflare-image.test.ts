import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { DesignBrief } from "./brief";
import { CloudflareImageProvider, sniffImageType } from "./cloudflare-image";
import { getImageProvider, NotConnectedProvider } from "./provider";

// A local stand-in for api.cloudflare.com: no real token or network needed.
let server: http.Server;
let lastRequest: { url: string; headers: http.IncomingHttpHeaders; body: Record<string, unknown> } | null;
let nextResponse: { status: number; type: string; body: Buffer | string };
const JPEG = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const json = (status: number, body: unknown) => ({ status, type: "application/json", body: JSON.stringify(body) });

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      lastRequest = { url: req.url ?? "", headers: req.headers, body: JSON.parse(raw || "{}") };
      res.writeHead(nextResponse.status, { "content-type": nextResponse.type });
      res.end(nextResponse.body);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.CLOUDFLARE_API_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  for (const k of ["CLOUDFLARE_API_BASE_URL", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "IMAGE_PROVIDER"]) delete process.env[k];
});
beforeEach(() => {
  lastRequest = null;
  process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
  process.env.CLOUDFLARE_API_TOKEN = "cf-test-not-real";
});

const brief: DesignBrief = {
  designType: "Promotional poster",
  style: "Bold & colourful",
  businessName: "Glow Co",
  productName: "Vanilla candle",
  colors: { primary: "#112233", secondary: "#FFFFFF", accent: "#FF8800" },
  uploads: {},
};

describe("CloudflareImageProvider", () => {
  it("calls Workers AI with a Bearer token and decodes the base64 image", async () => {
    nextResponse = json(200, { result: { image: JPEG.toString("base64") }, success: true, errors: [], messages: [] });
    const result = await new CloudflareImageProvider().generate("Poster for Glow Co", brief);

    expect(result).toMatchObject({ status: "completed", provider: "cloudflare", image: { contentType: "image/jpeg" } });
    if (result.status === "completed") expect(Buffer.from(result.image.bytes)).toEqual(JPEG);
    expect(lastRequest!.url).toBe("/accounts/acct123/ai/run/@cf/black-forest-labs/flux-1-schnell");
    expect(lastRequest!.headers.authorization).toBe("Bearer cf-test-not-real");
    expect(lastRequest!.body.prompt).toMatch(/^Poster for Glow Co .*Promotional poster layout\.$/);
  });

  it("accepts models that return the image itself", async () => {
    nextResponse = { status: 200, type: "image/png", body: PNG };
    expect(await new CloudflareImageProvider().generate("x", brief)).toMatchObject({ status: "completed", image: { contentType: "image/png" } });
  });

  it("caps the prompt at Cloudflare's 2,048 characters", async () => {
    nextResponse = json(200, { result: { image: JPEG.toString("base64") } });
    await new CloudflareImageProvider().generate("x".repeat(5000), brief);
    expect(String(lastRequest!.body.prompt)).toHaveLength(2048);
  });

  it.each([
    [429, { errors: [{ code: 4006, message: "you have used up your daily free allocation of 10,000 neurons" }] }, /free Cloudflare image allowance is used up/],
    [401, { errors: [{ code: 10000, message: "Authentication error" }] }, /rejected the API token/],
    [404, { errors: [{ code: 7003, message: "No route" }] }, /CLOUDFLARE_ACCOUNT_ID/],
    [429, { errors: [{ code: 971, message: "Too many requests" }] }, /wait a minute/],
    [503, { errors: [] }, /busy/],
  ])("explains HTTP %i in plain language", async (status, body, message) => {
    nextResponse = json(status, { success: false, ...body });
    const result = await new CloudflareImageProvider().generate("x", brief);
    expect(result).toMatchObject({ status: "failed", error: expect.stringMatching(message) });
    if (result.status === "failed") expect(result.error).not.toContain("cf-test-not-real");
  });

  it("rejects replies without a real image", async () => {
    nextResponse = json(200, { result: {} });
    expect(await new CloudflareImageProvider().generate("x", brief)).toMatchObject({ status: "failed" });
    nextResponse = json(200, { result: { image: Buffer.from("<svg/>").toString("base64") } });
    expect(await new CloudflareImageProvider().generate("x", brief)).toMatchObject({ status: "failed" });
  });
});

describe("sniffImageType", () => {
  it("recognises PNG, JPEG and WebP, and nothing else", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(Buffer.from("<svg></svg>"))).toBeNull();
  });
});

describe("getImageProvider", () => {
  it("uses Cloudflare only with both the account ID and token", () => {
    process.env.IMAGE_PROVIDER = "cloudflare";
    expect(getImageProvider()).toBeInstanceOf(CloudflareImageProvider);
    expect(getImageProvider().note).toMatch(/square/);
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(getImageProvider()).toBeInstanceOf(NotConnectedProvider);
    delete process.env.IMAGE_PROVIDER;
  });
});
