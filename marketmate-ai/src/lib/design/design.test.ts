import { describe, expect, it } from "vitest";
import { buildImagePrompt, designBriefSchema, uploadsBelongToUser } from "./brief";
import { getImageProvider, NotConnectedProvider } from "./provider";

const brief = designBriefSchema.parse({
  designType: "Promotional poster",
  style: "Clean & minimal",
  businessName: "Glow Co",
  productName: "Lavender candle",
  price: "$24",
  promotion: "20% off this weekend",
  contact: "hello@glow.example",
  handles: "@glowco",
  colors: { primary: "#112233", secondary: "#FFFFFF", accent: "#FF8800" },
  uploads: { logo: "user-1/logo.png" },
});

describe("design brief", () => {
  it("builds an image prompt from the brief", () => {
    const p = buildImagePrompt(brief);
    expect(p).toContain('"Glow Co"');
    expect(p).toContain("Lavender candle");
    expect(p).toContain('"$24"');
    expect(p).toContain("20% off this weekend");
    expect(p).toContain("hello@glow.example");
    expect(p).toContain("@glowco");
    expect(p).toMatch(/^Promotional poster/);
    expect(p).toContain("#FF8800");
    expect(p).toContain("supplied logo");
    expect(p).not.toContain("product photo");
  });

  it("rejects invalid colours", () => {
    const r = designBriefSchema.safeParse({ ...brief, colors: { ...brief.colors, primary: "red" } });
    expect(r.success).toBe(false);
  });

  it("only accepts uploads from the caller's own folder", () => {
    expect(uploadsBelongToUser(brief, "user-1")).toBe(true);
    expect(uploadsBelongToUser(brief, "user-2")).toBe(false);
    expect(
      uploadsBelongToUser({ ...brief, uploads: { logo: "user-1/../user-2/x.png" } }, "user-1"),
    ).toBe(false);
  });
});

describe("image provider", () => {
  it("is honestly not connected by default and never returns an image", async () => {
    const provider = getImageProvider();
    expect(provider).toBeInstanceOf(NotConnectedProvider);
    expect(provider.connected).toBe(false);
    const result = await provider.generate(buildImagePrompt(brief), brief);
    expect(result.status).toBe("not_connected");
    expect(result).not.toHaveProperty("imageUrl");
  });
});
