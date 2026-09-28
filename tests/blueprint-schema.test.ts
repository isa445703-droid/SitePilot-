import { describe, expect, it } from "vitest";
import { blueprintSchema } from "@/lib/ai/schemas";

/**
 * The blueprint is the contract between the model and the app: anything Mistral
 * returns must be plain data that either validates or is rejected — never
 * partially trusted.
 */
describe("blueprint schema", () => {
  const validBlueprint = {
    siteName: "Nordic Explorer",
    description: "Travel guides for Scandinavia.",
    targetAudience: "Independent travellers",
    primaryGoal: "Grow organic traffic",
    language: "EN",
    tone: "Warm and practical",
    categories: [
      { name: "Destinations", description: "Country guides" },
      { name: "Seasons", description: "" },
    ],
    pages: [
      { title: "Home", slug: "", purpose: "Landing page" },
      { title: "About", slug: "about", purpose: "Who we are" },
    ],
    contentTypes: ["guide", "checklist"],
    publishingFrequency: "THREE_A_WEEK",
    seoStrategy: {
      approach: "Seasonal long-tail keywords",
      keywords: ["northern lights"],
    },
    monetization: ["affiliate"],
    design: {
      primaryColor: "#1d4ed8",
      secondaryColor: "#0f172a",
      backgroundColor: "#ffffff",
      textColor: "#0f172a",
      fontStyle: "editorial",
      layoutStyle: "wide",
      cardStyle: "soft",
      borderRadius: 14,
    },
  };

  it("accepts a complete blueprint and normalizes the language", () => {
    const result = blueprintSchema.parse(validBlueprint);
    expect(result.siteName).toBe("Nordic Explorer");
    expect(result.language).toBe("en");
    expect(result.categories).toHaveLength(2);
    expect(result.pages[0].slug).toBe("");
    expect(result.design?.borderRadius).toBe(14);
  });

  it("applies defaults for optional text fields", () => {
    const result = blueprintSchema.parse({
      siteName: "Minimal",
      categories: [{ name: "A" }],
      pages: [{ title: "Home" }],
      seoStrategy: { approach: "", keywords: [] },
    });
    expect(result.description).toBe("");
    expect(result.tone).toBe("");
    expect(result.contentTypes).toEqual([]);
    expect(result.publishingFrequency).toBe("THREE_A_WEEK");
    expect(result.monetization).toEqual([]);
    expect(result.pages[0].slug).toBe("");
    expect(result.pages[0].purpose).toBe("");
  });

  it("rejects an empty site name", () => {
    const result = blueprintSchema.safeParse({ ...validBlueprint, siteName: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a URL-hostile page slug", () => {
    const result = blueprintSchema.safeParse({
      ...validBlueprint,
      pages: [{ title: "Home", slug: "not a slug!" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-object input (no code/executable payloads)", () => {
    expect(blueprintSchema.safeParse("process.exit(1)").success).toBe(false);
    expect(blueprintSchema.safeParse(null).success).toBe(false);
    expect(blueprintSchema.safeParse({ siteName: 42 }).success).toBe(false);
  });

  it("falls back for malformed colors instead of failing the whole plan", () => {
    const result = blueprintSchema.parse({
      ...validBlueprint,
      design: { ...validBlueprint.design, primaryColor: "rebeccapurple" },
    });
    expect(result.design?.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
