import { describe, expect, it } from "vitest";
import { businessSchema } from "./schema";

describe("businessSchema", () => {
  it("normalises empty fields to null and adds https:// to bare websites", () => {
    const r = businessSchema.parse({ name: "Glow Co", website: "glow.example", phone: "", email: "" });
    expect(r).toMatchObject({ name: "Glow Co", website: "https://glow.example", phone: null, email: null, industry: null });
  });

  it("validates email, phone and URL", () => {
    expect(businessSchema.safeParse({ name: "x", email: "nope" }).success).toBe(false);
    expect(businessSchema.safeParse({ name: "x", email: "hi@glow.example" }).success).toBe(true);
    expect(businessSchema.safeParse({ name: "x", phone: "+1 (246) 555-0100" }).success).toBe(true);
    expect(businessSchema.safeParse({ name: "x", phone: "call me" }).success).toBe(false);
    expect(businessSchema.safeParse({ name: "x", website: "javascript:alert(1)" }).success).toBe(false);
    expect(businessSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
