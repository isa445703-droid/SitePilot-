import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { getOwnedArticle, getOwnedSite } from "@/lib/auth/guards";
import { accessibleSiteIds } from "@/lib/services/activity";
import { generateArticleDraft } from "@/lib/ai";
import { throwAgentFailure, withAgentRun } from "@/lib/agents/run";
import { countWords, slugify, uniqueSlug } from "@/lib/utils/slug";
import { enqueueTask } from "@/lib/agents/orchestrator";
import { runEditorAgent } from "@/lib/agents/editor";
import { runSeoAgent } from "@/lib/agents/seo";
import { runPublisherAgent } from "@/lib/agents/publisher";

export const articleFilterSchema = z.object({
  siteId: z.string().optional(),
  status: z
    .enum(["DRAFT", "REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"])
    .optional(),
  q: z.string().max(200).optional(),
  categoryId: z.string().optional(),
  take: z.number().int().min(1).max(100).default(50),
});

export const articleWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().max(600).optional(),
  content: z.string().max(200_000).optional(),
  categoryId: z.string().nullish(),
  tags: z.array(z.string().max(60)).max(12).optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(180).optional(),
  status: z.enum(["DRAFT", "REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]).optional(),
});

export type ArticleFilter = z.infer<typeof articleFilterSchema>;
export type ArticleWrite = z.infer<typeof articleWriteSchema>;

export async function listArticles(userId: string, filter: ArticleFilter) {
  if (filter.siteId) {
    const site = await getOwnedSite(filter.siteId, userId);
    if (!site) return [];
    return findArticles(filter);
  }
  const siteIds = await accessibleSiteIds(userId);
  if (siteIds.length === 0) return [];
  return findArticles({ ...filter, siteIds });
}

async function findArticles(filter: ArticleFilter & { siteIds?: string[] }) {
  return db.article.findMany({
    where: {
      ...(filter.siteId ? { siteId: filter.siteId } : {}),
      ...(filter.siteIds ? { siteId: { in: filter.siteIds } } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.q
        ? {
            OR: [
              { title: { contains: filter.q, mode: "insensitive" } },
              { excerpt: { contains: filter.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: filter.take,
    include: {
      site: { select: { id: true, name: true, slug: true, language: true } },
      category: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function getArticle(articleId: string, userId: string) {
  return getOwnedArticle(articleId, userId);
}

export async function createArticle(input: {
  siteId: string;
  userId: string;
  data: ArticleWrite;
}) {
  const site = await getOwnedSite(input.siteId, input.userId);
  if (!site) throw new Error("Forbidden");

  const others = await db.article.findMany({ where: { siteId: input.siteId }, select: { slug: true } });
  const slug = uniqueSlug(slugify(input.data.title, "article"), others.map((a) => a.slug));

  return db.article.create({
    data: {
      siteId: input.siteId,
      categoryId: input.data.categoryId ?? null,
      title: input.data.title,
      slug,
      excerpt: input.data.excerpt ?? "",
      content: input.data.content ?? "",
      tags: input.data.tags ?? [],
      status: input.data.status ?? "DRAFT",
      seoTitle: input.data.seoTitle ?? "",
      seoDescription: input.data.seoDescription ?? "",
      language: site.language,
      author: "Manual draft",
      wordCount: countWords(input.data.content ?? ""),
    },
  });
}

export async function updateArticle(input: {
  articleId: string;
  userId: string;
  data: Partial<ArticleWrite>;
}) {
  const article = await getOwnedArticle(input.articleId, input.userId);
  if (!article) throw new Error("Forbidden");

  const data: Record<string, unknown> = {};
  if (input.data.title !== undefined) data.title = input.data.title;
  if (input.data.excerpt !== undefined) data.excerpt = input.data.excerpt;
  if (input.data.content !== undefined) {
    data.content = input.data.content;
    data.wordCount = countWords(input.data.content);
  }
  if (input.data.categoryId !== undefined) data.categoryId = input.data.categoryId;
  if (input.data.tags !== undefined) data.tags = input.data.tags;
  if (input.data.seoTitle !== undefined) data.seoTitle = input.data.seoTitle;
  if (input.data.seoDescription !== undefined) data.seoDescription = input.data.seoDescription;
  if (input.data.status !== undefined) {
    data.status = input.data.status;
    if (input.data.status === "PUBLISHED" && !article.publishedAt) data.publishedAt = new Date();
    if (input.data.status !== "PUBLISHED") data.publishedAt = null;
  }

  return db.article.update({ where: { id: input.articleId }, data });
}

/** Queues (and immediately runs) an AI generation task for one article. */
export async function generateArticleTask(input: {
  siteId: string;
  userId: string;
  title?: string;
  category?: string;
  instruction?: string;
}) {
  const site = await getOwnedSite(input.siteId, input.userId);
  if (!site) throw new Error("Forbidden");

  const category = input.category
    ? await db.category.findFirst({ where: { siteId: input.siteId, name: input.category } })
    : null;

  const task = await enqueueTask({
    siteId: input.siteId,
    type: "GENERATE_ARTICLE",
    input: {
      title:
        input.title?.trim() ||
        fallbackTitle(site.blueprint),
      category: input.category ?? category?.name ?? "",
      categoryId: category?.id,
      instruction: input.instruction,
      research: true,
      initial: false,
    },
  });

  const { runTask } = await import("@/lib/agents/orchestrator");
  const outcome = await runTask(task.id);
  return { task, outcome };
}

function fallbackTitle(blueprint: unknown): string {
  const plan = (blueprint as { contentTypes?: string[] } | null) ?? null;
  const seed = plan?.contentTypes?.[0] ?? "Getting started";
  return `${seed}: a practical guide`;
}

export type AiAction = "improve" | "rewrite" | "seo" | "edit";

/** Synchronous in-request AI actions used by the editor UI. */
export async function runArticleAiAction(input: {
  articleId: string;
  userId: string;
  action: AiAction;
  instruction?: string;
}) {
  const article = await getOwnedArticle(input.articleId, input.userId);
  if (!article) throw new Error("Forbidden");

  if (input.action === "seo") {
    const result = await runSeoAgent({
      siteId: article.siteId,
      articleId: article.id,
      mode: "optimize",
    });
    if (!result.ok) throwAgentFailure(result);
    return { action: input.action, result: result.value };
  }

  const result = await runEditorAgent({
    siteId: article.siteId,
    articleId: article.id,
    mode: input.action === "rewrite" ? "rewrite" : input.action === "improve" ? "improve" : "edit",
    instruction: input.instruction,
  });
  if (!result.ok) throwAgentFailure(result);
  return { action: input.action, result: result.value };
}

export async function publishArticle(input: {
  articleId: string;
  userId: string;
  action?: "publish" | "unpublish" | "approve";
}) {
  const article = await getOwnedArticle(input.articleId, input.userId);
  if (!article) throw new Error("Forbidden");

  const result = await runPublisherAgent({
    siteId: article.siteId,
    articleId: article.id,
    action: input.action ?? "publish",
  });
  if (!result.ok) throwAgentFailure(result);
  return result.value;
}

export async function archiveArticle(input: { articleId: string; userId: string }) {
  const article = await getOwnedArticle(input.articleId, input.userId);
  if (!article) throw new Error("Forbidden");
  return db.article.update({ where: { id: article.id }, data: { status: "ARCHIVED" } });
}

/**
 * (Re)generates the body of an existing article in place. The result is
 * written through the Writer Agent so it appears in the activity log.
 */
export async function regenerateArticleContent(input: {
  articleId: string;
  userId: string;
  title?: string;
  instruction?: string;
}) {
  const article = await getOwnedArticle(input.articleId, input.userId);
  if (!article) throw new Error("Forbidden");

  const [site, brand] = await Promise.all([
    db.site.findUnique({ where: { id: article.siteId } }),
    db.siteBrand.findUnique({ where: { siteId: article.siteId } }),
  ]);
  if (!site) throw new Error("Forbidden");

  const outcome = await withAgentRun(
    {
      agent: "writer",
      siteId: article.siteId,
      input: { action: "generate_article", title: input.title ?? article.title },
      output: (o: any) => `${o.words ?? 0} words`,
    },
    async (ctx) => {
      const generated = await generateArticleDraft({
        title: input.title?.trim() || article.title,
        siteName: site.name,
        language: site.language,
        audience: site.targetAudience,
        brandVoice: [brand?.brandVoice, brand?.tone].filter(Boolean).join(" "),
        tone: site.tone,
        keywords: brand?.keywords ?? [],
        instruction: input.instruction,
        wordTarget: 900,
      });
      ctx.recordUsage(generated.usage);
      ctx.setDemo(generated.isDemo);
      return generated;
    },
  );

  if (!outcome.ok) throwAgentFailure(outcome);

  const data = outcome.value.data;
  const updated = await db.article.update({
    where: { id: article.id },
    data: {
      title: data.title || article.title,
      excerpt: data.excerpt || article.excerpt,
      content: data.content,
      tags: data.tags.length ? data.tags : article.tags,
      seoTitle: data.seoTitle || article.seoTitle || data.title.slice(0, 60),
      seoDescription: data.seoDescription || article.seoDescription,
      language: site.language,
      wordCount: countWords(data.content),
      status: article.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      author: outcome.value.isDemo ? "SitePilot (demo)" : "SitePilot AI",
    },
  });

  return { article: updated, isDemo: outcome.value.isDemo };
}
