import "server-only";
import { db } from "@/lib/db/prisma";
import { generateArticleDraft } from "@/lib/ai";
import { countWords, slugify, uniqueSlug } from "@/lib/utils/slug";
import { withAgentRun, type AgentRunResult } from "./run";
import { assertPermission } from "./permissions";
import { audienceOf, brandVoiceOf, loadSiteBundle } from "./context";

export type WriterAgentInput = {
  siteId: string;
  taskId?: string | undefined;
  title: string;
  categoryId?: string | null;
  category?: string;
  status?: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED";
  instruction?: string;
  researchText?: string;
  keywords?: string[];
  wordTarget?: number;
};

export type WriterAgentOutput = {
  articleId: string;
  title: string;
  isDemo: boolean;
  words: number;
};

/**
 * Writer Agent — allowed: create_draft, read_site, read_content, research.
 * Explicitly NOT allowed to publish.
 */
export async function runWriterAgent(
  input: WriterAgentInput,
): Promise<AgentRunResult<WriterAgentOutput>> {
  assertPermission("writer", "create_draft");
  assertPermission("writer", "read_site");

  return withAgentRun<WriterAgentOutput>(
    {
      agent: "writer",
      siteId: input.siteId,
      taskId: input.taskId,
      input: { title: input.title, category: input.category ?? "" },
      output: (o) => `created “${o.title}” (${o.words} words)`,
    },
    async (ctx) => {
      const bundle = await loadSiteBundle("writer", input.siteId);
      const site = bundle.site;

      const outcome = await generateArticleDraft({
        title: input.title,
        siteName: site.name,
        language: site.language,
        audience: audienceOf(bundle),
        brandVoice: brandVoiceOf(bundle),
        tone: site.tone || bundle.brand?.tone || "",
        category: input.category ?? bundle.categories.find((c: any) => c.id === input.categoryId)?.name,
        keywords: input.keywords ?? (bundle.brand?.keywords ?? []).slice(0, 6),
        research: input.researchText,
        instruction: input.instruction,
        wordTarget: input.wordTarget ?? 900,
      });
      ctx.recordUsage(outcome.usage);
      ctx.setDemo(outcome.isDemo);

      const generated = outcome.data;
      const existing = await db.article.findMany({
        where: { siteId: input.siteId },
        select: { slug: true },
      });
      const slug = uniqueSlug(slugify(generated.slug || generated.title, "article"), existing.map((a) => a.slug));

      const categoryId =
        input.categoryId ??
        bundle.categories.find((c: any) => c.name === generated.category)?.id ??
        bundle.categories[0]?.id ??
        null;

      const article = await db.article.create({
        data: {
          siteId: input.siteId,
          categoryId,
          title: generated.title,
          slug,
          excerpt: generated.excerpt,
          content: generated.content,
          status: input.status ?? "DRAFT",
          tags: generated.tags,
          author: outcome.isDemo ? "SitePilot (demo)" : "SitePilot AI",
          language: site.language,
          seoTitle: generated.seoTitle || generated.title.slice(0, 60),
          seoDescription: generated.seoDescription || generated.excerpt.slice(0, 155),
          wordCount: countWords(generated.content),
          scheduledAt: null,
        },
      });

      for (const title of generated.sourceTitles.slice(0, 5)) {
        await db.contentSource
          .create({
            data: {
              siteId: input.siteId,
              articleId: article.id,
              title,
              url: "",
              snippet: "",
              provider: outcome.isDemo ? "demo" : "model",
              isMock: outcome.isDemo,
            },
          })
          .catch(() => undefined);
      }

      return { articleId: article.id, title: article.title, isDemo: outcome.isDemo, words: article.wordCount };
    },
  );
}
