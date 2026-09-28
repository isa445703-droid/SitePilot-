import "server-only";
import { z } from "zod";
import { aiConfig } from "@/lib/env";
import {
  AiNotConfiguredError,
  generateStructuredOutput,
  generateText,
  isAiConfigured,
  type AiUsage,
} from "./mistral";
import {
  blueprintSchema,
  contentPlanSchema,
  generatedArticleSchema,
  pageContentSchema,
  researchResultSchema,
  seoSuggestionSchema,
  siteAnalysisSchema,
  type Blueprint,
  type ContentPlan,
  type GeneratedArticle,
  type PageContent,
  type ResearchResult,
  type SeoSuggestion,
  type SiteAnalysis,
} from "./schemas";
import { blueprintPrompt, blueprintSystem } from "./prompts/blueprint";
import { editorPrompt, editorSystem } from "./prompts/editor";
import { orchestratorPrompt, orchestratorSystem } from "./prompts/orchestrator";
import { pagePrompt, pageSystem } from "./prompts/page";
import { researchPrompt, researchSystem } from "./prompts/research";
import { seoPrompt, seoSystem } from "./prompts/seo";
import { writerPrompt, writerSystem } from "./prompts/writer";
import {
  DEMO_MARKER,
  demoAnalysis,
  demoArticle,
  demoBlueprint,
  demoContentPlan,
  demoPageContent,
  demoResearch,
  demoSeo,
} from "./demo";

export type AiOutcome<T> = {
  data: T;
  isDemo: boolean;
  model: string;
  usage: AiUsage;
};

export { AiNotConfiguredError, isAiConfigured };

const NO_USAGE: AiUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

/**
 * Runs an AI generation and falls back to clearly-marked demo output when no
 * provider is configured — but only outside production, where a missing key is
 * an error instead of fake content.
 */
async function withFallback<S extends z.ZodTypeAny>({
  schema,
  system,
  prompt,
  demo,
  model,
  maxTokens,
}: {
  schema: S;
  system: string;
  prompt: string;
  demo: () => z.infer<S>;
  model?: string;
  maxTokens?: number;
}): Promise<AiOutcome<z.infer<S>>> {
  if (isAiConfigured()) {
    const result = await generateStructuredOutput({ schema, system, prompt, model, maxTokens });
    return { data: result.data, isDemo: false, model: result.model, usage: result.usage };
  }

  if (aiConfig.isProduction) throw new AiNotConfiguredError();

  return { data: demo(), isDemo: true, model: "demo", usage: NO_USAGE };
}

/* -------------------------------------------------------------------------- */
/* Blueprint                                                                  */
/* -------------------------------------------------------------------------- */

export async function generateBlueprint(input: {
  brief: string;
  siteName?: string;
  language: string;
  timezone?: string;
  designBrief?: string;
}): Promise<AiOutcome<Blueprint>> {
  return withFallback({
    schema: blueprintSchema,
    system: blueprintSystem,
    prompt: blueprintPrompt(input),
    demo: () => demoBlueprint(input),
    maxTokens: 5000,
  });
}

/* -------------------------------------------------------------------------- */
/* Content plan                                                               */
/* -------------------------------------------------------------------------- */

export async function generateContentPlan(input: {
  siteName: string;
  language: string;
  audience?: string;
  keywords?: string[];
  categories: string[];
  count?: number;
}): Promise<AiOutcome<ContentPlan>> {
  return withFallback({
    schema: contentPlanSchema,
    system: writerSystem,
    prompt: [
      `Site: ${input.siteName}`,
      `Content language: ${input.language}`,
      input.audience ? `Audience: ${input.audience}` : "",
      input.keywords?.length ? `Focus keywords: ${input.keywords.join(", ")}` : "",
      `Categories: ${input.categories.join(", ")}`,
      "",
      `Plan ${input.count ?? 9} article ideas. Return JSON: { items: [{ title, topic, category, intent, keywords }] }`,
    ]
      .filter(Boolean)
      .join("\n"),
    demo: () => demoContentPlan({ siteName: input.siteName, count: input.count ?? 9 }),
    model: aiConfig.fastModel,
  });
}

/* -------------------------------------------------------------------------- */
/* Static pages                                                               */
/* -------------------------------------------------------------------------- */

export async function generatePageContent(input: {
  siteName: string;
  siteDescription: string;
  pageTitle: string;
  pagePurpose: string;
  pageType: string;
  language: string;
  audience?: string;
  tone?: string;
  keywords?: string[];
}): Promise<AiOutcome<PageContent>> {
  return withFallback({
    schema: pageContentSchema,
    system: pageSystem,
    prompt: pagePrompt(input),
    demo: () =>
      demoPageContent({
        pageTitle: input.pageTitle,
        pagePurpose: input.pagePurpose,
        siteName: input.siteName,
        language: input.language,
      }),
    model: aiConfig.fastModel,
    maxTokens: 2500,
  });
}

/* -------------------------------------------------------------------------- */
/* Article writing                                                            */
/* -------------------------------------------------------------------------- */

export async function generateArticleDraft(input: {
  title: string;
  siteName: string;
  language: string;
  audience?: string;
  brandVoice?: string;
  tone?: string;
  category?: string;
  keywords?: string[];
  research?: string;
  instruction?: string;
  wordTarget?: number;
}): Promise<AiOutcome<GeneratedArticle>> {
  return withFallback({
    schema: generatedArticleSchema,
    system: writerSystem,
    prompt: writerPrompt(input),
    maxTokens: 8000,
    demo: () =>
      demoArticle({
        title: input.title,
        siteName: input.siteName,
        language: input.language,
        category: input.category,
      }),
  });
}

/** Editor pass: improve / rewrite / apply a direction to an existing body. */
export async function reviseArticle(input: {
  title: string;
  body: string;
  language: string;
  brandVoice?: string;
  instruction?: string;
  mode: "improve" | "rewrite" | "edit";
}): Promise<AiOutcome<{ title: string; excerpt: string; content: string; tags: string[]; seoTitle: string; seoDescription: string }>> {
  const schema = z.object({
    title: z.string().max(200),
    excerpt: z.string().max(600).default(""),
    content: z.string().min(40),
    tags: z.array(z.string().max(60)).max(20).default([]),
    seoTitle: z.string().max(90).default(""),
    seoDescription: z.string().max(300).default(""),
  });

  return withFallback({
    schema,
    system: editorSystem,
    maxTokens: 8000,
    prompt: editorPrompt({
      title: input.title,
      body: input.body,
      language: input.language,
      instruction: input.instruction ?? "",
      brandVoice: input.brandVoice,
      mode: input.mode,
    }),
    demo: () => {
      const note = `${DEMO_MARKER}\n\n> Demo mode: the editor action was simulated because no AI provider is configured.`;
      const content = `${note}\n\n${input.body}`;
      return {
        title: input.title,
        excerpt: "",
        content,
        tags: [],
        seoTitle: "",
        seoDescription: "",
      };
    },
  });
}

/* -------------------------------------------------------------------------- */
/* SEO                                                                        */
/* -------------------------------------------------------------------------- */

export async function generateSeo(input: {
  title: string;
  excerpt?: string;
  body: string;
  language: string;
  keywords?: string[];
  siteName?: string;
  mode: "optimize" | "initial";
}): Promise<AiOutcome<SeoSuggestion>> {
  return withFallback({
    schema: seoSuggestionSchema,
    system: seoSystem,
    prompt: seoPrompt(input),
    demo: () => demoSeo({ title: input.title }),
    model: aiConfig.fastModel,
  });
}

/* -------------------------------------------------------------------------- */
/* Research                                                                   */
/* -------------------------------------------------------------------------- */

export async function researchTopic(input: {
  topic: string;
  siteName: string;
  language: string;
  audience?: string;
  brandVoice?: string;
  existingNotes?: Array<{ title: string; detail: string; provider: string }>;
}): Promise<AiOutcome<ResearchResult>> {
  return withFallback({
    schema: researchResultSchema,
    system: researchSystem,
    prompt: researchPrompt(input),
    demo: () => demoResearch(input.topic),
    model: aiConfig.fastModel,
    // Research payloads run long — the default budget was cutting the JSON off
    // mid-string, which then cost a full retry.
    maxTokens: 6000,
  });
}

/* -------------------------------------------------------------------------- */
/* Analysis / orchestration                                                   */
/* -------------------------------------------------------------------------- */

export async function analyzeSite(input: {
  siteName: string;
  language: string;
  autopilot: string;
  frequency: string;
  stats: { articles: number; published: number; queued: number; seoIssues: number };
  lastActivity?: string;
  scheduledContent?: string;
}): Promise<AiOutcome<SiteAnalysis>> {
  return withFallback({
    schema: siteAnalysisSchema,
    system: orchestratorSystem,
    prompt: orchestratorPrompt(input),
    demo: () =>
      demoAnalysis({
        articles: input.stats.articles,
        published: input.stats.published,
        seoIssues: input.stats.seoIssues,
      }),
  });
}

/** Free-form text helper used by simple tasks (summaries, tags, titles). */
export async function generatePlainText(options: {
  system: string;
  prompt: string;
  fast?: boolean;
  language?: string;
}): Promise<AiOutcome<string>> {
  if (isAiConfigured()) {
    const result = await generateText({
      system: options.system,
      prompt: options.prompt,
      model: options.fast ? aiConfig.fastModel : aiConfig.model,
    });
    return { data: result.text, isDemo: false, model: result.model, usage: result.usage };
  }
  if (aiConfig.isProduction) throw new AiNotConfiguredError();
  return { data: "", isDemo: true, model: "demo", usage: NO_USAGE };
}
