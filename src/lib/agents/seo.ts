import "server-only";
import { db } from "@/lib/db/prisma";
import { generateSeo } from "@/lib/ai";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { withAgentRun, type AgentRunResult } from "./run";
import { assertPermission } from "./permissions";
import { loadSiteBundle } from "./context";

export type SeoIssueDraft = {
  type:
    | "missing_title"
    | "missing_description"
    | "missing_h1"
    | "broken_link"
    | "missing_canonical"
    | "duplicate_slug"
    | "long_slug";
  severity: "info" | "warning" | "error";
  message: string;
  articleId?: string | null;
  pageId?: string | null;
};

/**
 * Pure SEO evaluation — no database access, so it is easy to unit test.
 * Checks: metadata, heading structure, internal links, canonical, slugs.
 */
export function evaluateSeoIssues(input: {
  articles: Array<{
    id: string;
    title: string;
    slug: string;
    content: string;
    seoTitle: string;
    seoDescription: string;
    canonicalUrl: string;
    status: string;
  }>;
  pages: Array<{ id: string; title: string; slug: string; seoTitle: string; seoDescription: string }>;
}): SeoIssueDraft[] {
  const issues: SeoIssueDraft[] = [];
  const knownSlugs = new Set<string>([
    "",
    ...input.articles.map((a) => a.slug),
    ...input.pages.map((p) => p.slug),
    ...input.articles.map((a) => a.title),
  ]);

  const slugCounts = new Map<string, number>();
  for (const a of input.articles) slugCounts.set(a.slug, (slugCounts.get(a.slug) ?? 0) + 1);

  for (const article of input.articles) {
    if (!article.seoTitle.trim()) {
      issues.push({
        type: "missing_title",
        severity: "error",
        message: `“${article.title}” has no SEO title.`,
        articleId: article.id,
      });
    }
    if (!article.seoDescription.trim()) {
      issues.push({
        type: "missing_description",
        severity: "warning",
        message: `“${article.title}” has no meta description.`,
        articleId: article.id,
      });
    }
    const hasHeading = /^#{1,6}\s+\S/m.test(article.content);
    if (!hasHeading) {
      issues.push({
        type: "missing_h1",
        severity: "warning",
        message: `“${article.title}” has no heading structure.`,
        articleId: article.id,
      });
    }
    if (article.slug.length > 60) {
      issues.push({
        type: "long_slug",
        severity: "info",
        message: `Slug “${article.slug}” is longer than 60 characters.`,
        articleId: article.id,
      });
    }
    if ((slugCounts.get(article.slug) ?? 0) > 1) {
      issues.push({
        type: "duplicate_slug",
        severity: "error",
        message: `Slug “${article.slug}” is used more than once.`,
        articleId: article.id,
      });
    }
    if (article.status === "PUBLISHED" && !article.canonicalUrl.trim()) {
      issues.push({
        type: "missing_canonical",
        severity: "info",
        message: `“${article.title}” has no explicit canonical URL.`,
        articleId: article.id,
      });
    }

    const links = [...article.content.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
    for (const href of links) {
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const clean = href.split(/[?#]/)[0].replace(/^\/|\/$/g, "");
      if (clean === "") continue;
      const lastSegment = clean.split("/").pop() ?? "";
      if (!knownSlugs.has(clean) && !knownSlugs.has(lastSegment)) {
        issues.push({
          type: "broken_link",
          severity: "warning",
          message: `“${article.title}” links to a page that does not exist: ${href}`,
          articleId: article.id,
        });
        break;
      }
    }
  }

  for (const page of input.pages) {
    if (!page.seoTitle.trim()) {
      issues.push({
        type: "missing_title",
        severity: "warning",
        message: `Page “${page.title}” has no SEO title.`,
        pageId: page.id,
      });
    }
    if (!page.seoDescription.trim()) {
      issues.push({
        type: "missing_description",
        severity: "info",
        message: `Page “${page.title}” has no meta description.`,
        pageId: page.id,
      });
    }
  }

  return issues;
}

export type SeoAuditResult = {
  issues: number;
  fixed: number;
  isDemo: boolean;
};

/** SEO Agent (audit mode) — persists resolved/created issues for the site. */
export async function runSeoAudit(input: {
  siteId: string;
  taskId?: string | undefined;
  fix?: boolean;
}): Promise<AgentRunResult<SeoAuditResult>> {
  assertPermission("seo", "set_metadata");

  return withAgentRun<SeoAuditResult>(
    {
      agent: "seo",
      siteId: input.siteId,
      taskId: input.taskId,
      input: { action: "audit", fix: Boolean(input.fix) },
      output: (o) => `${o.issues} issues, ${o.fixed} fixed`,
    },
    async () => {
      const [articles, pages] = await Promise.all([
        db.article.findMany({ where: { siteId: input.siteId } }),
        db.page.findMany({ where: { siteId: input.siteId } }),
      ]);

      const drafts = evaluateSeoIssues({
        articles: articles.map((a) => ({
          id: a.id,
          title: a.title,
          slug: a.slug,
          content: a.content,
          seoTitle: a.seoTitle,
          seoDescription: a.seoDescription,
          canonicalUrl: a.canonicalUrl,
          status: a.status,
        })),
        pages: pages.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
        })),
      });

      let fixed = 0;
      if (input.fix) {
        for (const article of articles) {
          const data: Record<string, unknown> = {};
          if (!article.seoTitle.trim()) data.seoTitle = article.title.slice(0, 60);
          if (!article.seoDescription.trim())
            data.seoDescription = (article.excerpt || article.title).slice(0, 155);
          if (article.status === "PUBLISHED" && !article.canonicalUrl.trim())
            data.canonicalUrl = `/a/${article.slug}`;
          if (Object.keys(data).length > 0) {
            await db.article.update({ where: { id: article.id }, data });
            fixed++;
          }
        }
        for (const page of pages) {
          const data: Record<string, unknown> = {};
          if (!page.seoTitle.trim()) data.seoTitle = page.title.slice(0, 60);
          if (!page.seoDescription.trim()) data.seoDescription = page.title.slice(0, 155);
          if (Object.keys(data).length > 0) {
            await db.page.update({ where: { id: page.id }, data });
            fixed++;
          }
        }
      }

      // Replace the previous open issues for this site with the fresh set.
      await db.seoIssue.deleteMany({ where: { siteId: input.siteId, resolved: false } });
      for (const issue of drafts) {
        await db.seoIssue.create({
          data: {
            siteId: input.siteId,
            articleId: issue.articleId ?? null,
            pageId: issue.pageId ?? null,
            type: issue.type,
            severity: issue.severity,
            message: issue.message,
            resolved: input.fix,
          },
        });
      }

      return { issues: drafts.length, fixed, isDemo: false };
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Metadata generation for a single article                                   */
/* -------------------------------------------------------------------------- */

export type SeoAgentOutput = { articleId: string; slug: string; isDemo: boolean };

export async function runSeoAgent(input: {
  siteId: string;
  taskId?: string | undefined;
  articleId: string;
  mode?: "optimize" | "initial";
}): Promise<AgentRunResult<SeoAgentOutput>> {
  assertPermission("seo", "set_metadata");

  return withAgentRun<SeoAgentOutput>(
    {
      agent: "seo",
      siteId: input.siteId,
      taskId: input.taskId,
      input: { articleId: input.articleId, mode: input.mode ?? "optimize" },
      output: (o) => `slug=${o.slug}`,
    },
    async (ctx) => {
      const bundle = await loadSiteBundle("seo", input.siteId);
      const article = await db.article.findUnique({ where: { id: input.articleId } });
      if (!article) throw new Error("Article not found");
      if (article.siteId !== input.siteId) throw new Error("Article does not belong to this site");

      const outcome = await generateSeo({
        title: article.title,
        excerpt: article.excerpt,
        body: article.content,
        language: article.language || bundle.site.language,
        keywords: bundle.brand?.keywords ?? [],
        siteName: bundle.site.name,
        mode: input.mode ?? "optimize",
      });
      ctx.recordUsage(outcome.usage);
      ctx.setDemo(outcome.isDemo);

      const suggestion = outcome.data;
      let slug = article.slug;
      if (suggestion.slug && suggestion.slug !== article.slug && !outcome.isDemo) {
        const others = await db.article.findMany({
          where: { siteId: input.siteId, id: { not: article.id } },
          select: { slug: true },
        });
        slug = uniqueSlug(slugify(suggestion.slug, article.slug), others.map((a) => a.slug));
      }

      await db.article.update({
        where: { id: article.id },
        data: {
          seoTitle: suggestion.seoTitle || article.seoTitle || article.title.slice(0, 60),
          seoDescription:
            suggestion.seoDescription || article.seoDescription || article.excerpt.slice(0, 155),
          slug,
          tags: suggestion.tags.length ? suggestion.tags : article.tags,
          language: article.language || bundle.site.language,
        },
      });

      return { articleId: article.id, slug, isDemo: outcome.isDemo };
    },
  );
}
