import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  closeUnbalanced,
  formatIssues,
  normalizeForSchema,
  parseJsonLoose,
  stripFences,
} from "@/lib/ai/repair";
import { generatedArticleSchema, researchResultSchema } from "@/lib/ai/schemas";

process.env.MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "test-key";

describe("parseJsonLoose", () => {
  it("unwraps markdown fences", () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    const result = parseJsonLoose('```json\n{"a":1}\n```');
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("finds the payload behind prose", () => {
    const result = parseJsonLoose('Sure! Here is the JSON you asked for: {"a": 2} — enjoy.');
    expect(result).toEqual({ ok: true, value: { a: 2 } });
  });

  it("tolerates trailing commas", () => {
    expect(parseJsonLoose('{"a": [1, 2,],}')).toEqual({ ok: true, value: { a: [1, 2] } });
  });

  it("closes unclosed structures when explicitly allowed", () => {
    const closed = parseJsonLoose('{"a": {"b": [1, 2', { closeUnbalanced: true });
    expect(closed).toEqual({ ok: true, value: { a: { b: [1, 2] } } });
  });

  it("refuses to close a string that was cut mid-value (cut content must not validate)", () => {
    const truncated = '{"title": "half a title and the body was cut mid-sen';
    expect(parseJsonLoose(truncated)).toEqual({ ok: false, reason: "invalid" });
    expect(parseJsonLoose(truncated, { closeUnbalanced: true }).ok).toBe(false);
    // The escape hatch exists, but only for callers that know the text is whole.
    expect(parseJsonLoose(truncated, { closeUnbalanced: true, closeString: true }).ok).toBe(true);
  });

  it("closes unclosed brackets when the text between them is complete", () => {
    const result = parseJsonLoose('{"a": {"b": [1, 2', { closeUnbalanced: true });
    expect(result).toEqual({ ok: true, value: { a: { b: [1, 2] } } });
  });

  it("reports empty input distinctly", () => {
    expect(parseJsonLoose("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("closeUnbalanced balances brackets without touching string content", () => {
    expect(closeUnbalanced('{"a": "text with } and [ inside", "b": [1, 2')).toBe(
      '{"a": "text with } and [ inside", "b": [1, 2]}',
    );
  });

  it("closeUnbalanced leaves an unfinished string alone unless opted in", () => {
    expect(closeUnbalanced('{"a": "cut mid')).toBe('{"a": "cut mid');
    expect(closeUnbalanced('{"a": "cut mid', { closeString: true })).toBe('{"a": "cut mid"}');
  });
});

describe("normalizeForSchema", () => {
  it("passes valid data through untouched", () => {
    const schema = z.object({ title: z.string().max(50) });
    const input = { title: "short" };
    const result = normalizeForSchema(schema, input);
    expect(result).toEqual({ ok: true, data: { title: "short" }, fixes: [] });
    expect(input).toEqual({ title: "short" });
  });

  it("truncates over-long strings to the declared maximum", () => {
    const schema = z.object({ seoTitle: z.string().max(90) });
    const result = normalizeForSchema(schema, { seoTitle: "R".repeat(150) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.seoTitle).toHaveLength(90);
  });

  it("prefers a word boundary when cutting", () => {
    const schema = z.object({ note: z.string().max(20) });
    const result = normalizeForSchema(schema, { note: "hello wonderful world of cycling" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.note).toBe("hello wonderful");
    }
  });

  it("trims over-long arrays instead of failing", () => {
    const schema = z.object({ items: z.array(z.string()).max(3) });
    const result = normalizeForSchema(schema, { items: ["a", "b", "c", "d", "e"] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.items).toEqual(["a", "b", "c"]);
  });

  it("fixes nested paths inside arrays", () => {
    const schema = z.object({ items: z.array(z.object({ name: z.string().max(5) })) });
    const result = normalizeForSchema(schema, { items: [{ name: "way too long name" }] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.items[0].name).toBe("way");
  });

  it("unwraps an object where a string was expected", () => {
    const schema = z.object({ content: z.string().min(1) });
    const result = normalizeForSchema(schema, { content: { text: "the body" } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.content).toBe("the body");
  });

  it("coerces numeric and boolean strings", () => {
    expect(normalizeForSchema(z.object({ n: z.number() }), { n: "42" })).toMatchObject({
      ok: true,
      data: { n: 42 },
    });
    expect(normalizeForSchema(z.object({ b: z.boolean() }), { b: "yes" })).toMatchObject({
      ok: true,
      data: { b: true },
    });
  });

  it("never invents a missing required value", () => {
    const schema = z.object({ content: z.string().min(40) });
    const result = normalizeForSchema(schema, { title: "present" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fixes).toEqual([]);
      expect(result.issues.some((i) => i.path.join(".") === "content")).toBe(true);
    }
  });

  it("reports the path of every applied fix", () => {
    const schema = z.object({ items: z.array(z.string()).max(2) });
    const result = normalizeForSchema(schema, { items: ["a", "b", "c"] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fixes).toEqual([{ path: "items", action: "trim_array<=2" }]);
  });

  it("repairing real article payloads makes the production schema accept them", () => {
    const payload = {
      title: "A very long article title that the model refused to shorten at all",
      slug: "a-very-long-article-title",
      excerpt: "short",
      content: { markdown: `${"Body text ".repeat(20)}` },
      tags: Array.from({ length: 30 }, (_, i) => `tag${i}`),
      seoTitle: `SEO title that is far beyond ninety characters ${"and keeps going".repeat(6)}`,
      seoDescription: "d".repeat(500),
      category: "guides",
      sourceTitles: Array.from({ length: 15 }, (_, i) => `source-${i}`),
    };

    const result = normalizeForSchema(generatedArticleSchema, payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.seoTitle.length).toBeLessThanOrEqual(90);
      expect(result.data.seoDescription.length).toBeLessThanOrEqual(300);
      expect(result.data.tags.length).toBeLessThanOrEqual(20);
      expect(result.data.sourceTitles.length).toBeLessThanOrEqual(8);
      expect(typeof result.data.content).toBe("string");
      expect(result.fixes.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("trims the research topic list the model overshot", () => {
    const result = normalizeForSchema(researchResultSchema, {
      summary: "summary",
      notes: [],
      suggestedTopics: Array.from({ length: 16 }, (_, i) => `topic ${i}`),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.suggestedTopics).toHaveLength(10);
  });
});

describe("formatIssues", () => {
  it("stays bounded so the retry prompt cannot balloon", () => {
    const issues = Array.from({ length: 20 }, (_, i) => ({
      code: "too_big" as const,
      expected: "string" as const,
      received: "string" as const,
      path: [`field${i}`],
      message: "x".repeat(100),
    })) as unknown as Parameters<typeof formatIssues>[0];

    const text = formatIssues(issues);
    expect(text.length).toBeLessThanOrEqual(400);
    expect(text.split(";").length).toBeLessThanOrEqual(5);
  });
});

/* -------------------------------------------------------------------------- */
/* generateStructuredOutput — end to end against a mocked provider            */
/* -------------------------------------------------------------------------- */

type StubbedCall = { content: string; finish?: string };

function stubProvider(responses: StubbedCall[]) {
  const bodies: Array<Record<string, unknown>> = [];
  let index = 0;

  const fetchMock = vi.fn(async (_url: unknown, init?: { body?: string }) => {
    bodies.push(init?.body ? JSON.parse(init.body) : {});
    const next = responses[Math.min(index, responses.length - 1)];
    index++;
    return {
      ok: true,
      json: async () => ({
        model: "stub-model",
        choices: [{ message: { content: next.content }, finish_reason: next.finish ?? "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    } as unknown as Response;
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, bodies };
}

function requestBodies(bodies: Array<Record<string, unknown>>) {
  return bodies.map((body) => {
    const messages = body.messages as Array<{ role: string; content: string }>;
    return {
      maxTokens: body.max_tokens as number,
      userPrompt: messages.find((m) => m.role === "user")?.content ?? "",
    };
  });
}

const validArticle = {
  title: "How to ride a bike in the city",
  slug: "how-to-ride-a-bike-in-the-city",
  excerpt: "A short excerpt.",
  content: `${"Practical advice for city riding. ".repeat(5)}`,
  tags: ["cycling"],
  seoTitle: "City cycling guide",
  seoDescription: "Everything about city cycling.",
  category: "guides",
  sourceTitles: [],
};

async function run() {
  const { generateStructuredOutput } = await import("@/lib/ai/mistral");
  return generateStructuredOutput({
    system: "system",
    prompt: "the prompt",
    schema: generatedArticleSchema,
    timeoutMs: 5_000,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateStructuredOutput", () => {
  it("accepts fenced JSON on the first attempt", async () => {
    const { fetchMock, bodies } = stubProvider([
      { content: `\`\`\`json\n${JSON.stringify(validArticle)}\n\`\`\`` },
    ]);

    const result = await run();
    expect(result.data.title).toBe(validArticle.title);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestBodies(bodies)[0].maxTokens).toBe(3000);
  });

  it("repairs an over-long field without spending a second call", async () => {
    const { fetchMock } = stubProvider([
      { content: JSON.stringify({ ...validArticle, seoTitle: "S".repeat(150) }) },
    ]);

    const result = await run();
    expect(result.data.seoTitle.length).toBeLessThanOrEqual(90);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries with a doubled budget after a truncated completion", async () => {
    const { fetchMock, bodies } = stubProvider([
      { content: '{"title": "cut off mid-w', finish: "length" },
      { content: JSON.stringify(validArticle) },
    ]);

    const result = await run();
    expect(result.data.title).toBe(validArticle.title);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBodies(bodies).map((b) => b.maxTokens)).toEqual([3000, 6000]);
  });

  it("fails loudly instead of accepting a truncated answer", async () => {
    const { fetchMock, bodies } = stubProvider([{ content: '{"title": "cut', finish: "length" }]);

    await expect(run()).rejects.toThrow(/truncated/i);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestBodies(bodies).map((b) => b.maxTokens)).toEqual([3000, 6000, 12000]);
  });

  it("feeds the exact schema issues back to the model", async () => {
    const { fetchMock, bodies } = stubProvider([
      { content: JSON.stringify({ title: "only a title" }) },
      { content: JSON.stringify(validArticle) },
    ]);

    const result = await run();
    expect(result.data.title).toBe(validArticle.title);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondPrompt = requestBodies(bodies)[1].userPrompt;
    expect(secondPrompt).toContain("Your previous answer was invalid");
    expect(secondPrompt).toContain("content");
  });

  it("logs truncation with readable numbers (the logger redacts /token/i keys)", async () => {
    const { logger } = await import("@/lib/logger");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    stubProvider([
      { content: '{"title": "cut', finish: "length" },
      { content: JSON.stringify(validArticle) },
    ]);
    await run();

    const entry = warn.mock.calls.find(([message]) => message === "ai_structured_truncated");
    expect(entry).toBeDefined();
    const payload = entry?.[1] as Record<string, unknown>;
    expect(payload.previousMax).toBe(3000);
    expect(payload.max).toBe(6000);
    warn.mockRestore();
  });

  it("reports malformed JSON after exhausting attempts", async () => {
    const { fetchMock } = stubProvider([{ content: "definitely not json" }]);

    await expect(run()).rejects.toThrow(/not valid JSON/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports missing required fields after exhausting attempts", async () => {
    stubProvider([{ content: JSON.stringify({ title: "t" }) }]);

    await expect(run()).rejects.toThrow(/content: Required/);
  });
});
