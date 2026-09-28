import { describe, expect, it } from "vitest";
import { contentPlanSchema, generatedArticleSchema, seoSuggestionSchema } from "@/lib/ai/schemas";

/**
 * Article generation output: the model's response must validate before anything
 * is written to the database.
 */
describe("generated article response", () => {
  const valid = {
    title: "Northern lights in Tromsø",
    slug: "northern-lights-tromso",
    excerpt: "Where to stand and when to go.",
    content: "# Northern lights in Tromsø\n\nStand still, look north, and give it four nights.",
    tags: ["norway", "aurora"],
    seoTitle: "Northern lights in Tromsø — practical guide",
    seoDescription: "Best viewpoints and forecast tools for aurora hunting.",
    category: "Seasons",
    sourceTitles: ["Visit Tromsø"],
  };

  it("accepts a complete article payload", () => {
    const result = generatedArticleSchema.parse(valid);
    expect(result.slug).toBe("northern-lights-tromso");
    expect(result.tags).toContain("norway");
    expect(result.category).toBe("Seasons");
    expect(result.sourceTitles).toEqual(["Visit Tromsø"]);
  });

  it("applies defaults for optional fields", () => {
    const result = generatedArticleSchema.parse({
      title: "Minimal article",
      content: "x".repeat(60),
    });
    expect(result.slug).toBe("");
    expect(result.excerpt).toBe("");
    expect(result.tags).toEqual([]);
    expect(result.seoTitle).toBe("");
    expect(result.category).toBe("");
  });

  it("rejects a missing title or a too-short body", () => {
    expect(generatedArticleSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
    expect(generatedArticleSchema.safeParse({ ...valid, content: "short" }).success).toBe(false);
  });

  it("rejects a URL-hostile slug", () => {
    expect(generatedArticleSchema.safeParse({ ...valid, slug: "Bad Slug!" }).success).toBe(false);
  });

  it("rejects non-string tags (typed data only)", () => {
    expect(generatedArticleSchema.safeParse({ ...valid, tags: ["ok", 42] }).success).toBe(false);
    expect(generatedArticleSchema.safeParse({ ...valid, tags: "norway" }).success).toBe(false);
  });

  it("rejects oversized titles, descriptions and too many tags", () => {
    expect(generatedArticleSchema.safeParse({ ...valid, title: "a".repeat(201) }).success).toBe(false);
    expect(
      generatedArticleSchema.safeParse({ ...valid, seoDescription: "d".repeat(301) }).success,
    ).toBe(false);
    expect(
      generatedArticleSchema.safeParse({
        ...valid,
        tags: Array.from({ length: 21 }, (_, index) => `tag-${index}`),
      }).success,
    ).toBe(false);
  });

  it("never accepts executable payloads", () => {
    expect(generatedArticleSchema.safeParse("process.exit(1)").success).toBe(false);
    expect(generatedArticleSchema.safeParse({ title: {}, content: "" }).success).toBe(false);
  });

  it("validates SEO suggestions", () => {
    expect(
      seoSuggestionSchema.safeParse({
        seoTitle: "A title",
        seoDescription: "A description",
        tags: ["a"],
        internalLinkIdeas: [],
      }).success,
    ).toBe(true);
    expect(seoSuggestionSchema.safeParse({ seoTitle: 7 }).success).toBe(false);
  });

  it("validates a content plan", () => {
    expect(
      contentPlanSchema.safeParse({
        items: [
          {
            title: "Guide",
            slug: "guide",
            category: "Destinations",
            keywords: ["guide"],
            brief: "Write it",
          },
        ],
      }).success,
    ).toBe(true);
    expect(contentPlanSchema.safeParse({ items: "nope" }).success).toBe(false);
  });
});
