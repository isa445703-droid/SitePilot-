import { z } from "zod";

/** Shared primitives ------------------------------------------------------- */

export const languageSchema = z
  .string()
  .min(2)
  .max(10)
  .transform((v) => v.toLowerCase());

export const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex color like #2563eb")
  .catch("#2563eb");

const nonEmpty = z.string().trim().min(1);

/** Blueprint — the structured plan the AI produces from a natural brief. ---- */

export const blueprintCategorySchema = z.object({
  name: nonEmpty.max(80),
  description: z.string().max(400).default(""),
});

export const blueprintPageSchema = z.object({
  title: nonEmpty.max(120),
  slug: z
    .string()
    .max(120)
    .regex(/^[a-z0-9가-힣Ѐ-ӿ/-]*$/i, "Slug must be URL friendly")
    .default(""),
  purpose: z.string().max(300).default(""),
});

export const blueprintDesignSchema = z.object({
  primaryColor: colorSchema,
  secondaryColor: colorSchema,
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).catch("#ffffff"),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).catch("#0f172a"),
  fontStyle: z.enum(["modern", "classic", "editorial"]).catch("modern"),
  layoutStyle: z.enum(["centered", "wide", "magazine"]).catch("centered"),
  cardStyle: z.enum(["soft", "flat", "outlined"]).catch("soft"),
  borderRadius: z.number().int().min(0).max(32).catch(12),
});

export const blueprintSchema = z.object({
  siteName: nonEmpty.max(120),
  description: z.string().max(1000).default(""),
  targetAudience: z.string().max(600).default(""),
  primaryGoal: z.string().max(400).default(""),
  language: languageSchema.catch("en"),
  tone: z.string().max(400).default(""),
  categories: z.array(blueprintCategorySchema).min(1).max(12),
  pages: z.array(blueprintPageSchema).min(1).max(15),
  contentTypes: z.array(z.string().max(80)).max(15).default([]),
  publishingFrequency: z
    .enum(["ONCE_A_WEEK", "TWICE_A_WEEK", "THREE_A_WEEK", "FIVE_A_WEEK", "DAILY"])
    .catch("THREE_A_WEEK"),
  monetization: z.array(z.string().max(200)).max(8).default([]),
  seoStrategy: z
    .object({
      approach: z.string().max(600).default(""),
      keywords: z.array(z.string().max(80)).max(20).default([]),
    })
    .catch({ approach: "", keywords: [] }),
  design: blueprintDesignSchema.default({
    primaryColor: "#2563eb",
    secondaryColor: "#0f172a",
    backgroundColor: "#ffffff",
    textColor: "#0f172a",
    fontStyle: "modern",
    layoutStyle: "centered",
    cardStyle: "soft",
    borderRadius: 12,
  }),
});

export type Blueprint = z.infer<typeof blueprintSchema>;

/** Content plan ------------------------------------------------------------- */

export const contentPlanItemSchema = z.object({
  title: nonEmpty.max(160),
  topic: z.string().max(400).default(""),
  category: z.string().max(80).default(""),
  intent: z.enum(["informational", "commercial", "transactional", "navigational"]).catch(
    "informational",
  ),
  keywords: z.array(z.string().max(80)).max(10).default([]),
});

export const contentPlanSchema = z.object({
  items: z.array(contentPlanItemSchema).min(1).max(30),
});

export type ContentPlan = z.infer<typeof contentPlanSchema>;

/** Static page content ------------------------------------------------------ */

/** One content block of a generated page. Shapes match the public Blocks
 *  renderer exactly — data only, never raw HTML. */
export const pageBlockSchema = z.object({
  type: z.enum(["heading", "paragraph", "list", "quote"]).catch("paragraph"),
  level: z.number().int().min(1).max(4).catch(2),
  text: z.string().max(2000).catch(""),
  items: z.array(z.string().max(300)).max(12).catch([]),
});

export const pageContentSchema = z.object({
  seoTitle: z.string().max(90).catch(""),
  seoDescription: z.string().max(300).catch(""),
  blocks: z.array(pageBlockSchema).min(1).max(30),
});

export type PageBlock = z.infer<typeof pageBlockSchema>;
export type PageContent = z.infer<typeof pageContentSchema>;

/** Drops empty/normalizes blocks so rendered pages never show dead elements. */
export function normalizePageBlocks(blocks: PageBlock[], fallbackText: string): PageBlock[] {
  const cleaned: PageBlock[] = [];
  for (const block of blocks) {
    if (block.type === "list") {
      const items = block.items.map((item) => item.trim()).filter(Boolean).slice(0, 12);
      if (items.length > 0) cleaned.push({ ...block, items });
      continue;
    }
    const text = block.text.trim();
    if (!text) continue;
    if (block.type === "heading") {
      cleaned.push({ ...block, level: Math.min(Math.max(block.level, 2), 4), text: text.slice(0, 200) });
      continue;
    }
    cleaned.push({ ...block, text });
  }
  if (cleaned.length === 0) {
    cleaned.push({ type: "paragraph", level: 2, text: fallbackText.slice(0, 2000), items: [] });
  }
  return cleaned.slice(0, 30);
}

/** Article generation ------------------------------------------------------- */

export const generatedArticleSchema = z.object({
  title: nonEmpty.max(200),
  slug: z
    .string()
    .max(200)
    .regex(/^[a-z0-9가-힣Ѐ-ӿ/-]*$/i, "Slug must be URL friendly")
    .default(""),
  excerpt: z.string().max(600).default(""),
  content: z.string().min(40),
  tags: z.array(z.string().max(60)).max(20).default([]),
  seoTitle: z.string().max(90).default(""),
  seoDescription: z.string().max(300).default(""),
  category: z.string().max(80).default(""),
  sourceTitles: z.array(z.string().max(200)).max(8).default([]),
});

export type GeneratedArticle = z.infer<typeof generatedArticleSchema>;

/** SEO --------------------------------------------------------------------- */

export const seoSuggestionSchema = z.object({
  seoTitle: z.string().max(90).default(""),
  seoDescription: z.string().max(300).default(""),
  slug: z.string().max(200).default(""),
  tags: z.array(z.string().max(60)).max(20).default([]),
  internalLinkIdeas: z.array(z.string().max(160)).max(6).default([]),
});

export type SeoSuggestion = z.infer<typeof seoSuggestionSchema>;

/** Research ---------------------------------------------------------------- */

/** Pulls a human-readable string out of an LLM answer that insisted on
 * returning an object (e.g. { title, keywords }) instead of a plain string. */
const llmText = (max: number) =>
  z.preprocess((value) => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const key of ["title", "topic", "name", "keyword", "query", "idea"]) {
        if (typeof record[key] === "string") return record[key];
      }
      const firstString = Object.values(record).find((v) => typeof v === "string");
      if (typeof firstString === "string") return firstString;
    }
    return "";
  }, z.string().max(max)).catch("");

/** Coerces LLM booleans that arrive as "true"/"yes"/1 instead of true/false. */
const llmBoolean = z
  .preprocess((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return /^(true|yes|1|да)$/i.test(value.trim());
    return false;
  }, z.boolean())
  .default(false);

export const researchNoteSchema = z.object({
  title: nonEmpty.max(200),
  detail: z.string().max(1000).default(""),
  isFact: llmBoolean,
  assumption: llmBoolean,
  source: z.string().max(300).catch(""),
});

export const researchResultSchema = z.object({
  summary: z.string().max(2000).default(""),
  notes: z.array(researchNoteSchema).max(20).default([]),
  suggestedTopics: z.array(llmText(160)).max(10).default([]),
});

export type ResearchResult = z.infer<typeof researchResultSchema>;

/** Site analysis ------------------------------------------------------------ */

export const siteAnalysisSchema = z.object({
  health: z.enum(["good", "warn", "bad"]).catch("warn"),
  summary: z.string().max(1200).default(""),
  suggestions: z.array(z.string().max(300)).max(12).default([]),
  nextTasks: z
    .array(
      z.object({
        type: z.enum(["GENERATE_ARTICLE", "RESEARCH_TOPIC", "SEO_AUDIT", "UPDATE_ARTICLE"]),
        reason: z.string().max(300).default(""),
        topic: z.string().max(200).default(""),
      }),
    )
    .max(6)
    .default([]),
});

export type SiteAnalysis = z.infer<typeof siteAnalysisSchema>;
